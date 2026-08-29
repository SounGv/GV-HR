import { prisma } from "@/lib/prisma";
import { SHIFT_START_MIN, SHIFT_END_MIN, SATURDAY_SHIFT_END_MIN } from "@/lib/datetime";

export interface ShiftMinutes {
  startMin: number;
  endMin: number;
}

/**
 * The company default when no ShiftAssignment exists — Saturday is a
 * company-wide half day (09:00–12:00) for everyone, every other day is
 * 09:00–18:00. `workDate` is UTC midnight of the Bangkok calendar date (see
 * lib/datetime.ts's bangkokParts), so getUTCDay() reads the correct weekday.
 */
function defaultShiftFor(workDate: Date): ShiftMinutes {
  const isSaturday = workDate.getUTCDay() === 6;
  return { startMin: SHIFT_START_MIN, endMin: isSaturday ? SATURDAY_SHIFT_END_MIN : SHIFT_END_MIN };
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/**
 * An employee's real shift for one day, if HR scheduled one via "กะการทำงาน"
 * (ShiftAssignment → ShiftTemplate) — falls back to the company default
 * (see defaultShiftFor) when no assignment exists, which is the case for
 * most employees today.
 */
export async function resolveShiftMinutes(employeeId: string, workDate: Date): Promise<ShiftMinutes> {
  const assignment = await prisma.shiftAssignment.findUnique({
    where: { employeeId_date: { employeeId, date: workDate } },
    select: { template: { select: { startTime: true, endTime: true } } },
  });
  if (!assignment) return defaultShiftFor(workDate);
  return { startMin: parseHHMM(assignment.template.startTime), endMin: parseHHMM(assignment.template.endTime) };
}

/**
 * Batch version for report/import loops over many (employeeId, date) pairs —
 * one query for the whole range instead of one round-trip per row, which the
 * pooled DB connection (connection_limit=1) can't afford at report scale.
 */
export async function resolveShiftMinutesBatch(
  companyId: string,
  start: Date,
  end: Date,
): Promise<Map<string, ShiftMinutes>> {
  const assignments = await prisma.shiftAssignment.findMany({
    where: { companyId, date: { gte: start, lt: end } },
    select: { employeeId: true, date: true, template: { select: { startTime: true, endTime: true } } },
  });
  const map = new Map<string, ShiftMinutes>();
  for (const a of assignments) {
    map.set(`${a.employeeId}|${a.date.toISOString().slice(0, 10)}`, {
      startMin: parseHHMM(a.template.startTime),
      endMin: parseHHMM(a.template.endTime),
    });
  }
  return map;
}

export function shiftMinutesFromBatch(
  map: Map<string, ShiftMinutes>,
  employeeId: string,
  workDate: Date,
): ShiftMinutes {
  return map.get(`${employeeId}|${workDate.toISOString().slice(0, 10)}`) ?? defaultShiftFor(workDate);
}
