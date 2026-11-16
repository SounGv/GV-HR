/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit */
// Read-only. Splits the leave-balance differences into "balance kept more than the requests show" (opening usage brought over
// from before the system) and "balance kept less than the approved requests" (a deduction that was missed). Codes and counts only.
import { prisma as real } from "@real/prisma";

const COMPANY = "00000000-0000-0000-0000-000000000001";
(async () => {
  const before = await real.leaveBalance.count();
  const year = new Date().getFullYear();
  const yStart = new Date(Date.UTC(year, 0, 1)), yEnd = new Date(Date.UTC(year + 1, 0, 1));
  const balances = await real.leaveBalance.findMany({ where: { companyId: COMPANY, year }, select: { employeeId: true, type: true, usedDays: true, totalDays: true, employee: { select: { employeeCode: true } } } as any });
  const approved = await real.leaveRequest.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "APPROVED", startDate: { gte: yStart, lt: yEnd } }, select: { employeeId: true, type: true, unit: true, days: true, hours: true, startDate: true } });
  const usedBy = new Map<string, number>();
  for (const r of approved) if (r.unit !== "HOUR") usedBy.set(`${r.employeeId}|${r.type}`, (usedBy.get(`${r.employeeId}|${r.type}`) ?? 0) + r.days);
  const more: string[] = [], less: string[] = [];
  for (const b of balances as any[]) {
    const u = usedBy.get(`${b.employeeId}|${b.type}`) ?? 0;
    if (b.usedDays - u > 0.01) more.push(`${b.employee.employeeCode}/${b.type}:${b.usedDays}vs${u}`);
    else if (u - b.usedDays > 0.01) less.push(`${b.employee.employeeCode}/${b.type}:${b.usedDays}vs${u}`);
  }
  console.log(`balances ${balances.length}; kept MORE than requests ${more.length}; kept LESS than requests ${less.length}`);
  console.log("LESS (missed deduction?):", less.slice(0, 30).join(" | "));
  const noBal = [...usedBy.keys()].filter((k) => !(balances as any[]).some((b) => `${b.employeeId}|${b.type}` === k));
  console.log("approved days with no balance row:", noBal.length);
  const types = new Map<string, number>();
  for (const k of noBal) types.set(k.split("|")[1]!, (types.get(k.split("|")[1]!) ?? 0) + 1);
  console.log("by type:", [...types].map(([t, n]) => `${t}:${n}`).join(" "));
  console.log("approved requests this year:", approved.length, "earliest start:", approved.map((a) => a.startDate.toISOString().slice(0, 10)).sort()[0]);
  console.log("nothing written:", before === (await real.leaveBalance.count()));
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
