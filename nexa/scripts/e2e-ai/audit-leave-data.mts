/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit of leave request data */
// Read-only. Looks for leave requests whose data does not add up: overlaps, wrong day counts, hours that do not match the times,
// requests waiting too long. Prints counts and a few samples by employee code and date only. Writes nothing.
import { prisma as real } from "@real/prisma";
import { hhmmToMin } from "@/features/attendance-status/status-rules";

const COMPANY = "00000000-0000-0000-0000-000000000001";
const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
(async () => {
  const holidays = new Set((await real.holiday.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { date: true } })).map((h) => iso(h.date)));
  const leaves = await real.leaveRequest.findMany({
    where: { companyId: COMPANY, deletedAt: null, status: { in: ["APPROVED", "PENDING"] }, endDate: { gte: new Date(Date.now() - 120 * DAY) } },
    select: { id: true, employeeId: true, status: true, unit: true, halfDay: true, days: true, hours: true, startDate: true, endDate: true, startTime: true, endTime: true, type: true, createdAt: true, employee: { select: { employeeCode: true } } },
  });
  const cat: Record<string, string[]> = {};
  const add = (k: string, v: string) => (cat[k] ??= []).push(v);
  const workdays = (a: Date, b: Date) => { let n = 0; for (let d = new Date(a); d.getTime() <= b.getTime(); d = new Date(d.getTime() + DAY)) { const w = d.getUTCDay(); if (w !== 0 && w !== 6 && !holidays.has(iso(d))) n++; } return n; };

  for (const l of leaves) {
    const tag = `${l.employee.employeeCode} ${iso(l.startDate)}${l.endDate.getTime() !== l.startDate.getTime() ? ".." + iso(l.endDate) : ""} ${l.type}/${l.status}`;
    if (l.unit === "DAY") {
      const expect = l.halfDay ? 0.5 : workdays(l.startDate, l.endDate);
      if (Math.abs(l.days - expect) > 0.01) add("L2 day count does not match the working days in the range (weekends and holidays out)", `${tag} stored ${l.days} expected ${expect}`);
    } else {
      const a = hhmmToMin(l.startTime), b = hhmmToMin(l.endTime);
      if (a === null || b === null || b <= a) add("L5 hourly leave with bad times", `${tag} ${l.startTime}-${l.endTime}`);
      else if (l.hours !== null && Math.abs(l.hours - (b - a) / 60) > 0.01) add("L5 hours do not match the times", `${tag} ${l.startTime}-${l.endTime} stored ${l.hours}h`);
      if (l.startDate.getTime() !== l.endDate.getTime()) add("L5 hourly leave spanning more than one date", tag);
    }
    if (l.status === "PENDING" && Date.now() - l.createdAt.getTime() > 3 * DAY) add("L4 waiting for a decision for more than 3 days", `${tag} filed ${iso(l.createdAt)}`);
    if (l.status === "APPROVED" && l.endDate.getTime() < Date.now() - 1 * DAY && false) add("-", "-");
  }
  // overlaps between requests of the same person (approved or pending) on a shared working date
  const byEmp = new Map<string, typeof leaves>();
  for (const l of leaves) byEmp.set(l.employeeId, [...(byEmp.get(l.employeeId) ?? []), l]);
  for (const [, list] of byEmp) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      if (a.startDate.getTime() > b.endDate.getTime() || b.startDate.getTime() > a.endDate.getTime()) continue;
      const bothHour = a.unit === "HOUR" && b.unit === "HOUR";
      if (bothHour) {
        const as = hhmmToMin(a.startTime), ae = hhmmToMin(a.endTime), bs = hhmmToMin(b.startTime), be = hhmmToMin(b.endTime);
        if (as !== null && ae !== null && bs !== null && be !== null && as < be && bs < ae && a.startDate.getTime() === b.startDate.getTime()) add("L1 two hourly leaves overlap in time", `${a.employee.employeeCode} ${iso(a.startDate)} ${a.startTime}-${a.endTime} / ${b.startTime}-${b.endTime}`);
      } else if (!(a.unit === "HOUR" && b.unit === "HOUR")) {
        const dayOne = a.unit === "DAY" ? a : b;
        const other = a.unit === "DAY" ? b : a;
        if (dayOne.halfDay && other.unit === "DAY" && other.halfDay) continue; // AM + PM halves can coexist
        add("L1 a day leave overlaps another request of the same person", `${a.employee.employeeCode} ${iso(a.startDate)} ${a.unit}${a.halfDay ? "/half" : ""}/${a.status} with ${b.unit}${b.halfDay ? "/half" : ""}/${b.status}`);
      }
    }
  }
  console.log(JSON.stringify({ requestsChecked: leaves.length }));
  if (Object.keys(cat).length === 0) console.log("nothing found");
  for (const k of Object.keys(cat).sort()) console.log(`\n[${cat[k]!.length}] ${k}\n   ${cat[k]!.slice(0, 6).join("\n   ")}`);
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
