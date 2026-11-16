/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit across the places that show the same numbers */
// Read-only. Checks that the same number agrees wherever it is shown or kept: headcount, pending approvals, leave balances against
// approved requests, the home hero against the daily report, evaluation results against the report overview, and the org chart.
// Prints counts and codes only (no names). Writes nothing and fails if any row count changed.
import { prisma as real } from "@real/prisma";
import { getActionCenter, getDashboardSummary } from "@/features/dashboard/service";
import { loadTodayAttendance } from "@/features/attendance-status/service";
import { getReport } from "@/features/report/service";
import { loadEvaluationOverview } from "@/features/dashboard-people/evaluation-overview";

const COMPANY = "00000000-0000-0000-0000-000000000001";
type Line = { ok: boolean; name: string; detail?: string };
(async () => {
  const before = { e: await real.employee.count(), l: await real.leaveRequest.count(), a: await real.attendanceRecord.count() };
  const out: Line[] = [];
  const add = (ok: boolean, name: string, detail?: string) => out.push({ ok, name, detail });
  const actor = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const perms = ["leave:approve", "overtime:approve", "attendance:approve", "attendance:manage", "dashboard:read", "report:read", "employee:read", "employee:update", "campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
  const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.audit", roles: [], perms } as any;

  // S1 headcount
  const byStatus = await real.employee.groupBy({ by: ["status"], where: { companyId: COMPANY, deletedAt: null }, _count: { _all: true } });
  const working = byStatus.filter((s) => s.status === "ACTIVE" || s.status === "ON_LEAVE").reduce((a, s) => a + s._count._all, 0);
  const summary: any = await getDashboardSummary(COMPANY);
  add(summary.headcount === working, "S1 home headcount equals ACTIVE + ON_LEAVE in the employee table", `home ${summary.headcount} vs table ${working}; by status ${byStatus.map((s) => `${s.status}:${s._count._all}`).join(" ")}`);
  const byDept = await real.employee.groupBy({ by: ["departmentId"], where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } }, _count: { _all: true } });
  add(byDept.reduce((a, d) => a + d._count._all, 0) === working, "S1 departments add up to the headcount", `${byDept.length} groups, ${byDept.find((d) => d.departmentId === null)?._count._all ?? 0} with no department`);
  const byType = await real.employee.groupBy({ by: ["employmentType"], where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } }, _count: { _all: true } });
  add(byType.reduce((a, d) => a + d._count._all, 0) === working, "S1 employment types add up to the headcount", byType.map((t) => `${t.employmentType}:${t._count._all}`).join(" "));

  // S2 pending approvals
  const pending = { leave: await real.leaveRequest.count({ where: { companyId: COMPANY, deletedAt: null, status: "PENDING" } }), ot: await real.overtimeRequest.count({ where: { companyId: COMPANY, deletedAt: null, status: "PENDING" } }) };
  const ac: any = await getActionCenter(COMPANY, null, [], perms);
  const homeLeave = ac?.approvals?.leave ?? ac?.approvals?.LEAVE ?? null;
  add(homeLeave === null || homeLeave === pending.leave, "S2 home pending leave equals pending leave requests", `home ${JSON.stringify(ac?.approvals ?? {})} vs table leave ${pending.leave}, overtime ${pending.ot}`);

  // S3 leave balances against approved requests (this calendar year, by the year a request starts)
  const year = new Date().getFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year + 1, 0, 1));
  const balances = await real.leaveBalance.findMany({ where: { companyId: COMPANY, year }, select: { employeeId: true, type: true, usedDays: true, usedHours: true, employee: { select: { employeeCode: true } } } });
  const approved = await real.leaveRequest.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "APPROVED", startDate: { gte: yStart, lt: yEnd } }, select: { employeeId: true, type: true, unit: true, days: true, hours: true } });
  const usedBy = new Map<string, { d: number; h: number }>();
  for (const r of approved) { const k = `${r.employeeId}|${r.type}`; const c = usedBy.get(k) ?? { d: 0, h: 0 }; if (r.unit === "HOUR") c.h += r.hours ?? 0; else c.d += r.days; usedBy.set(k, c); }
  const diffs: string[] = [];
  for (const b of balances) { const u = usedBy.get(`${b.employeeId}|${b.type}`) ?? { d: 0, h: 0 }; if (Math.abs(u.d - b.usedDays) > 0.01) diffs.push(`${b.employee.employeeCode} ${b.type} days kept ${b.usedDays} vs requests ${u.d}`); }
  const noBalance = [...usedBy.keys()].filter((k) => !balances.some((b) => `${b.employeeId}|${b.type}` === k)).length;
  add(diffs.length === 0, "S3 used leave days kept in the balance equal the approved requests", `${balances.length} balances; ${diffs.length} differ${diffs.length ? ": " + diffs.slice(0, 5).join(" | ") : ""}; ${noBalance} person-type pairs have approved leave but no balance row`);

  // S4 hero against the daily report, today
  const today: any = await loadTodayAttendance(COMPANY, hr);
  const todayIso = today.dateIso;
  const rep: any = await getReport(COMPANY, { type: "attendance_daily", from: todayIso, to: todayIso } as any);
  const repScanned = rep.rows.filter((r: any) => r.clockIn && r.clockIn !== "-").length;
  const repLate = rep.rows.filter((r: any) => r.statusKey === "LATE").length;
  const checkedCodes = new Set(today.people.map((p: any) => p.code));
  const repScannedChecked = rep.rows.filter((r: any) => r.clockIn && r.clockIn !== "-" && checkedCodes.has(r.code)).length;
  add(today.scanned === repScannedChecked, "S4 home 'scanned' equals the daily report's scans for the same people", `home ${today.scanned} vs report ${repScannedChecked} (report has ${repScanned} scans in all)`);
  add(today.counts.LATE === rep.rows.filter((r: any) => r.statusKey === "LATE" && checkedCodes.has(r.code)).length, "S4 home late equals the daily report's late for the same people", `home ${today.counts.LATE} vs report ${repLate}`);

  // S5 evaluation results against the report overview
  const ev: any = await loadEvaluationOverview(COMPANY, hr);
  const perf: any = await getReport(COMPANY, { type: "performance" } as any);
  const repRounds: any[] = perf.evaluation?.rounds ?? [];
  for (const b of ev.resultsBoard) {
    const r = repRounds.find((x) => x.id === b.roundId);
    add(!!r && r.count === b.total && r.atTop === b.atTop, `S5 evaluation: home board equals the report overview for one round`, `home ${b.atTop}/${b.total} vs report ${r ? `${r.atTop}/${r.count}` : "missing"}`);
  }

  // S6 org chart integrity
  const emps = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { id: true, employeeCode: true, managerId: true } });
  const allEmps = await real.employee.findMany({ where: { companyId: COMPANY }, select: { id: true, status: true, deletedAt: true } });
  const inactive = new Set(allEmps.filter((e) => e.deletedAt || !["ACTIVE", "ON_LEAVE"].includes(e.status)).map((e) => e.id));
  const toInactive = emps.filter((e) => e.managerId && inactive.has(e.managerId)).map((e) => e.employeeCode);
  const selfMgr = emps.filter((e) => e.managerId === e.id).map((e) => e.employeeCode);
  const byId = new Map(emps.map((e) => [e.id, e]));
  const cyc: string[] = [];
  for (const e of emps) { const seen = new Set<string>(); let cur: string | null = e.id; while (cur && byId.has(cur)) { if (seen.has(cur)) { cyc.push(e.employeeCode); break; } seen.add(cur); cur = byId.get(cur)!.managerId; } }
  const noMgr = emps.filter((e) => !e.managerId).length;
  add(toInactive.length === 0 && selfMgr.length === 0 && cyc.length === 0, "S6 org chart: no one reports to a person who has left, to themselves, or in a loop", `reports to someone who left: ${toInactive.length} (${toInactive.slice(0, 6).join(",")}); self ${selfMgr.length}; loops ${cyc.length}; no manager ${noMgr}`);

  // S7 sign-in coverage and duplicates
  const linked = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] }, userId: { not: null } }, select: { id: true } });
  const withUser = new Set(linked.map((e) => e.id));
  const noUser = emps.filter((e) => !withUser.has(e.id)).length;
  add(true, "S7 (info) people without a sign-in account", `${noUser} of ${emps.length} working people have no user account`);
  const names = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } }, select: { employeeCode: true, firstName: true, lastName: true } });
  const nameCount = new Map<string, string[]>();
  for (const n of names) { const k = `${n.firstName}|${n.lastName ?? ""}`; nameCount.set(k, [...(nameCount.get(k) ?? []), n.employeeCode]); }
  const dups = [...nameCount.values()].filter((v) => v.length > 1);
  add(dups.length === 0, "S7 no two working people share the same full name", dups.length ? dups.map((d) => d.join("/")).join(" ; ") : "none");

  // S8 scans by people who are no longer working (last 30 days)
  const since = new Date(Date.now() - 30 * 86_400_000);
  const goneScans = await real.attendanceRecord.count({ where: { companyId: COMPANY, deletedAt: null, workDate: { gte: since }, employee: { status: { notIn: ["ACTIVE", "ON_LEAVE"] } } } });
  add(goneScans === 0, "S8 no scans in the last 30 days from people marked as having left", `${goneScans} scans`);

  const after = { e: await real.employee.count(), l: await real.leaveRequest.count(), a: await real.attendanceRecord.count() };
  add(JSON.stringify(after) === JSON.stringify(before), "nothing was written");
  for (const l of out) console.log(`${l.ok ? "OK   " : "CHECK"} ${l.name}${l.detail ? `\n         ${l.detail}` : ""}`);
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
