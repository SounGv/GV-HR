/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit */
// Read-only. For the last 30 days: every day the daily report calls someone absent, is there a leave request of any status for that
// person on that day? Splits by request status so we can see why a person who asked for leave still shows as absent. Codes and counts only.
import { prisma as real } from "@real/prisma";
import { getReport } from "@/features/report/service";

const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = await real.leaveRequest.count();
  const today = new Date(Date.now() + 7 * 3600_000);
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rep: any = await getReport(COMPANY, { type: "attendance_daily", from, to } as any);
  const absent = rep.rows.filter((r: any) => r.statusKey === "ABSENT");
  const leaves = await real.leaveRequest.findMany({
    where: { companyId: COMPANY, deletedAt: null, startDate: { lte: new Date(to) }, endDate: { gte: new Date(from) } },
    select: { status: true, startDate: true, endDate: true, unit: true, type: true, createdAt: true, employee: { select: { employeeCode: true } } },
  });
  const by = new Map<string, any[]>();
  for (const l of leaves) by.set(l.employee.employeeCode, [...(by.get(l.employee.employeeCode) ?? []), l]);
  const tally = new Map<string, string[]>();
  let noRequest = 0;
  for (const r of absent) {
    const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(String(r.date));
    const mon = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."].indexOf(m?.[2] ?? "");
    const iso = m && mon >= 0 ? `${Number(m[3]) - 543}-${String(mon + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : "";
    const hit = (by.get(r.code) ?? []).filter((l) => l.startDate.toISOString().slice(0, 10) <= iso && iso <= l.endDate.toISOString().slice(0, 10));
    if (!hit.length) { noRequest++; continue; }
    for (const l of hit) { const k = `${l.status}/${l.unit}`; tally.set(k, [...(tally.get(k) ?? []), `${r.code}@${iso}`]); }
  }
  console.log(`window ${from}..${to}; absent rows ${absent.length}; sample keys: ${Object.keys(absent[0] ?? {}).join(",")}`);
  console.log(`absent with no leave request at all that day: ${noRequest}`);
  for (const [k, v] of tally) console.log(`absent although a ${k} request covers the day: ${v.length} -> ${v.slice(0, 12).join(" ")}`);
  const ex = absent.slice(0, 3).map((r: any) => `${r.code}: ${r.detail ?? r.note ?? ""}`);
  console.log("date samples:", absent.slice(0,3).map((r:any)=>r.date).join(" | "));
  console.log("detail samples:", ex.join(" | "));
  console.log("nothing written:", before === (await real.leaveRequest.count()));
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
