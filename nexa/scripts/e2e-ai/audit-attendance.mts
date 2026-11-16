/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit of late / absent / leave across the places that decide them */
// Read-only. For each working day of the last 45 days and each person who uses the clock-in app, decide late / absent / leave the
// way the home page, the daily report and payroll each do, and list where they disagree or where leave and attendance clash.
// Prints counts and a few samples by employee code and date only (no names). Writes nothing.
import { prisma as real } from "@real/prisma";
import { bangkokParts, LATE_GRACE_MIN, lateOrPresent } from "@/lib/datetime";
import { resolveShiftMinutesBatch, shiftMinutesFromBatch } from "@/lib/attendance-shift";
import { classifyToday, excusedUntil, hhmmToMin, type HourRange } from "@/features/attendance-status/status-rules";

const COMPANY = "00000000-0000-0000-0000-000000000001";
const DAY = 86_400_000;
const DAYS_BACK = 45;
const iso = (d: Date) => d.toISOString().slice(0, 10);

(async () => {
  const today = bangkokParts().dateUTC;
  const from = new Date(today.getTime() - DAYS_BACK * DAY);
  const roster = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, select: { id: true, employeeCode: true, employmentType: true } });
  const used = new Set((await real.attendanceRecord.groupBy({ by: ["employeeId"], where: { companyId: COMPANY, deletedAt: null, workDate: { gte: from, lte: today } } })).map((u) => u.employeeId));
  const people = roster.filter((e) => used.has(e.id));
  const holidays = new Set((await real.holiday.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { date: true } })).map((h) => iso(h.date)));
  const recs = await real.attendanceRecord.findMany({ where: { companyId: COMPANY, deletedAt: null, workDate: { gte: from, lte: today }, employeeId: { in: people.map((p) => p.id) } }, select: { employeeId: true, workDate: true, clockInAt: true, status: true } });
  const recBy = new Map(recs.map((r) => [`${r.employeeId}|${iso(r.workDate)}`, r]));
  const leaves = await real.leaveRequest.findMany({ where: { companyId: COMPANY, deletedAt: null, status: { in: ["APPROVED", "PENDING"] }, endDate: { gte: from }, startDate: { lte: today }, employeeId: { in: people.map((p) => p.id) } }, select: { employeeId: true, status: true, unit: true, halfDay: true, halfDayPeriod: true, startDate: true, endDate: true, startTime: true, endTime: true, type: true } });
  const covering = (empId: string, d: Date) => leaves.filter((l) => l.employeeId === empId && l.startDate.getTime() <= d.getTime() && d.getTime() <= l.endDate.getTime());

  const cat: Record<string, string[]> = {};
  const add = (k: string, v: string) => (cat[k] ??= []).push(v);
  let dayCells = 0;
  for (let d = new Date(from); d.getTime() <= today.getTime(); d = new Date(d.getTime() + DAY)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6 || holidays.has(iso(d))) continue;
    const isToday = d.getTime() === today.getTime();
    const shiftMap = await resolveShiftMinutesBatch(COMPANY, d, new Date(d.getTime() + DAY));
    for (const e of people) {
      dayCells++;
      const r = recBy.get(`${e.id}|${iso(d)}`);
      const cover = covering(e.id, d);
      const approved = cover.filter((l) => l.status === "APPROVED");
      const pending = cover.filter((l) => l.status === "PENDING");
      const approvedDay = approved.some((l) => l.unit === "DAY");
      const approvedHour = approved.filter((l) => l.unit === "HOUR");
      const halfDay = approved.some((l) => l.unit === "DAY" && l.halfDay);
      const shift = shiftMinutesFromBatch(shiftMap, e.id, d, e.employmentType);
      const clockMin = r?.clockInAt ? bangkokParts(r.clockInAt).minutesOfDay : null;
      const ranges: HourRange[] = approvedHour.flatMap((l) => { const a = hhmmToMin(l.startTime); const b = hhmmToMin(l.endTime); return a === null || b === null ? [] : [{ startMin: a, endMin: b }]; });
      const excused = excusedUntil(ranges, shift.startMin);
      const nowMin = isToday ? bangkokParts().minutesOfDay : 24 * 60;
      const home = (ex: number | null) => classifyToday({ nowMin, shiftStartMin: shift.startMin, clockInMin: clockMin, onApprovedLeave: approvedDay, lateGraceMin: LATE_GRACE_MIN, excusedUntilMin: ex });
      const homeOld = home(null);
      const homeNew = home(excused);
      const tag = `${e.employeeCode} ${iso(d)}`;
      const reportLate = clockMin !== null && lateOrPresent(clockMin, Math.max(shift.startMin, excused ?? 0)) === "LATE";
      const payrollLate = r?.status === "LATE" && approved.length === 0;

      if (homeOld === "LATE" && homeNew === "NORMAL") add("1 hourly leave covers the arrival: the home page said late before the fix", `${tag} scan ${clockMin !== null ? Math.floor(clockMin / 60) + ":" + String(clockMin % 60).padStart(2, "0") : "-"}`);
      if (r?.status === "LATE" && clockMin !== null && !reportLate && approved.length === 0) add("2 stored LATE but on time against today's shift (payroll counts it, the report does not)", `${tag} shift ${shift.startMin} scan ${clockMin}`);
      if (clockMin !== null && reportLate && r?.status !== "LATE" && approved.length === 0) add("3 on the clock late against the shift but stored as not late (payroll misses it)", `${tag} shift ${shift.startMin} scan ${clockMin} stored ${r?.status}`);
      if (halfDay && reportLate) add("4 approved half-day leave and the daily report still says late (the monthly summary and payroll skip it)", `${tag}`);
      if (approvedDay && !halfDay && clockMin !== null) add("5 approved full-day leave but the person scanned in", `${tag}`);
      if (pending.length > 0 && (homeNew === "LATE" || homeNew === "ABSENT")) add("6 leave filed but not approved yet, and the person shows late or absent", `${tag} ${homeNew} ${pending.map((p) => p.unit + "/" + p.type).join(",")}`);
      if (pending.length > 0 && approved.length === 0 && clockMin !== null && !isToday) add("7 pending leave older than a day, still not decided", `${tag}`);
      if (!r && !approvedDay && pending.length === 0 && !isToday) add("8 no scan, no approved or pending leave on a working day (absent on the home page, 'to review' in payroll)", `${tag}`);
      if (payrollLate && homeNew !== "LATE" && clockMin !== null && !isToday) add("9 payroll would count late but the home rule says on time", `${tag}`);
      if (approvedHour.length > 0 && excused === null && approvedHour.some((l) => (hhmmToMin(l.startTime) ?? 0) < shift.startMin && (hhmmToMin(l.endTime) ?? 0) > shift.startMin)) add("10 hourly leave straddles the shift start but was not recognised", `${tag}`);
    }
  }
  console.log(JSON.stringify({ people: people.length, workingDayCells: dayCells, windowDays: DAYS_BACK }));
  for (const k of Object.keys(cat).sort()) console.log(`\n[${cat[k]!.length}] ${k}\n   ${cat[k]!.slice(0, 6).join("\n   ")}`);
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
