/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit */
// Read-only. Every way a person who asked for leave can still be shown as absent or late: pending requests, hourly and half-day
// requests, cancelled or rejected ones, requests that sit unanswered for days, and approved leave that the home page does not honour.
// Prints counts and employee codes only. Writes nothing and fails if the request count changed.
import { prisma as real } from "@real/prisma";
import { loadTodayAttendance } from "@/features/attendance-status/service";
import { getReport } from "@/features/report/service";

const COMPANY = "00000000-0000-0000-0000-000000000001";
const MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const isoOf = (thai: string) => { const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(thai); const i = MON.indexOf(m?.[2] ?? ""); return m && i >= 0 ? `${Number(m[3]) - 543}-${String(i + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : ""; };
const d10 = (d: Date) => d.toISOString().slice(0, 10);
const out: string[] = [];
const say = (flag: "OK" | "CHECK" | "INFO", s: string) => out.push(`${flag.padEnd(5)} ${s}`);

(async () => {
  const before = await real.leaveRequest.count();
  const now = new Date(Date.now() + 7 * 3600_000);
  const todayIso = d10(now);
  const from = d10(new Date(now.getTime() - 30 * 86_400_000));
  const perms = ["leave:approve", "overtime:approve", "attendance:approve", "attendance:manage", "dashboard:read", "report:read", "employee:read", "employee:update", "campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.audit", roles: [], perms } as any;

  const reqs = await real.leaveRequest.findMany({
    where: { companyId: COMPANY, deletedAt: null, endDate: { gte: new Date(from) } },
    select: { id: true, status: true, unit: true, type: true, halfDay: true, startDate: true, endDate: true, startTime: true, endTime: true, createdAt: true, employee: { select: { id: true, employeeCode: true } } },
  });
  const byStatus = new Map<string, number>();
  for (const r of reqs) byStatus.set(`${r.status}/${r.unit}`, (byStatus.get(`${r.status}/${r.unit}`) ?? 0) + 1);
  say("INFO", `requests touching the last 30 days: ${reqs.length} (${[...byStatus].map(([k, v]) => `${k}:${v}`).join(" ")})`);

  // today as the home page sees it
  const today: any = await loadTodayAttendance(COMPANY, hr);
  const st = new Map<string, any>(today.people.map((p: any) => [p.code, p]));
  say("INFO", `home people ${today.people.length}, date ${today.dateIso}, sample codes ${today.people.slice(0, 5).map((p: any) => p.code).join(",")}, has D0013 ${st.has("D0013")}`);
  const covers = (r: any, iso: string) => d10(r.startDate) <= iso && iso <= d10(r.endDate);

  // 1 pending requests covering today
  const pendToday = reqs.filter((r) => r.status === "PENDING" && covers(r, todayIso));
  say(pendToday.length ? "CHECK" : "OK", `pending requests covering today: ${pendToday.length}`);
  for (const r of pendToday) { const p = st.get(r.employee.employeeCode); say("INFO", `   ${r.employee.employeeCode} ${r.type}/${r.unit}${r.halfDay ? "/half" : ""} ${r.startTime ?? ""}-${r.endTime ?? ""} -> home shows ${p ? p.status : "not counted"}`); }

  // 2 approved leave covering today but home says something else
  const apprToday = reqs.filter((r) => r.status === "APPROVED" && r.unit === "DAY" && !r.halfDay && covers(r, todayIso));
  const wrong = apprToday.filter((r) => { const p = st.get(r.employee.employeeCode); return p && p.status !== "ON_LEAVE" && p.status !== "NORMAL"; }).map((r) => r.employee.employeeCode);
  say(wrong.length ? "CHECK" : "OK", `approved full-day leave today but the home page shows absent/late/not-yet: ${wrong.length} ${wrong.join(",")}`);
  const halfNo = reqs.filter((r) => r.status === "APPROVED" && r.halfDay && covers(r, todayIso)).map((r) => `${r.employee.employeeCode}:${st.get(r.employee.employeeCode)?.status ?? "-"}`);
  say("INFO", `approved half-day leave today and their status: ${halfNo.join(" ") || "none"}`);

  // 3 report: days called absent in the last 30 days while a request of any kind covers the day
  const rep: any = await getReport(COMPANY, { type: "attendance_daily", from, to: todayIso } as any);
  const absent = rep.rows.filter((r: any) => r.statusKey === "ABSENT");
  const lateRows = rep.rows.filter((r: any) => r.statusKey === "LATE");
  const tally = new Map<string, string[]>();
  for (const row of absent) {
    const iso = isoOf(row.date);
    for (const r of reqs.filter((q) => q.employee.employeeCode === row.code && covers(q, iso))) tally.set(`${r.status}/${r.unit}${r.halfDay ? "/half" : ""}`, [...(tally.get(`${r.status}/${r.unit}${r.halfDay ? "/half" : ""}`) ?? []), `${row.code}@${iso.slice(5)}`]);
  }
  say(tally.size === 0 ? "OK" : "INFO", `report absent days (${absent.length}) that have any request on the same day: ${[...tally].map(([k, v]) => `${k}:${v.length}[${v.slice(0, 6).join(" ")}]`).join("  ") || "none"}`);
  const lateTally: string[] = [];
  for (const row of lateRows) {
    const iso = isoOf(row.date);
    for (const r of reqs.filter((q) => q.employee.employeeCode === row.code && covers(q, iso) && q.status === "APPROVED")) lateTally.push(`${row.code}@${iso.slice(5)} ${r.unit}${r.halfDay ? "/half" : ""} ${r.startTime ?? ""}-${r.endTime ?? ""}`);
  }
  say(lateTally.length ? "CHECK" : "OK", `report late days that an APPROVED request covers: ${lateTally.length} ${lateTally.slice(0, 8).join(" | ")}`);

  // 4 requests waiting too long
  const stale = reqs.filter((r) => r.status === "PENDING" && d10(r.endDate) < todayIso);
  say(stale.length ? "CHECK" : "OK", `pending requests whose dates are already past (they stay as absent until answered): ${stale.length} ${stale.map((r) => `${r.employee.employeeCode}@${d10(r.startDate).slice(5)}`).join(" ")}`);
  const waitDays = reqs.filter((r) => r.status === "PENDING").map((r) => Math.floor((now.getTime() - r.createdAt.getTime()) / 86_400_000));
  say("INFO", `pending requests waiting: ${waitDays.length}, oldest ${waitDays.length ? Math.max(...waitDays) : 0} days`);

  // 5 requests made after the day (late filing)
  const after = reqs.filter((r) => r.status === "APPROVED" && r.createdAt > new Date(d10(r.endDate) + "T23:59:59+07:00"));
  say("INFO", `approved requests filed after the leave day had passed: ${after.length}`);

  // 6 hourly leave with no scan that day (counts as absent; correct only if the whole shift was missed)
  const hourNoScan = reqs.filter((r) => r.status === "APPROVED" && r.unit === "HOUR" && absent.some((a: any) => a.code === r.employee.employeeCode && isoOf(a.date) >= d10(r.startDate) && isoOf(a.date) <= d10(r.endDate)));
  say(hourNoScan.length ? "CHECK" : "OK", `approved hourly leave on a day the report calls absent: ${hourNoScan.length} ${hourNoScan.map((r) => `${r.employee.employeeCode}@${d10(r.startDate).slice(5)}`).join(" ")}`);

  // 7 leave on a weekend or holiday (counted as 0 days, harmless unless it shows as leave)
  const weekend = reqs.filter((r) => r.status === "APPROVED" && r.unit === "DAY" && d10(r.startDate) === d10(r.endDate) && [0, 6].includes(r.startDate.getUTCDay()));
  say("INFO", `approved one-day leave that falls on a Saturday or Sunday: ${weekend.length} ${weekend.slice(0, 6).map((r) => `${r.employee.employeeCode}@${d10(r.startDate).slice(5)}`).join(" ")}`);

  // 8 an employee marked ON_LEAVE as a status is dropped from every count
  const onLeaveStatus = await real.employee.count({ where: { companyId: COMPANY, deletedAt: null, status: "ON_LEAVE" } });
  say(onLeaveStatus ? "CHECK" : "OK", `employees whose status is ON_LEAVE (left out of the home counts): ${onLeaveStatus}`);

  say(before === (await real.leaveRequest.count()) ? "OK" : "CHECK", "nothing was written");
  console.log(out.join("\n"));
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
