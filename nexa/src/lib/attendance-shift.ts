import { prisma } from "@/lib/prisma";
import { SHIFT_START_MIN, SHIFT_END_MIN, SATURDAY_SHIFT_END_MIN } from "@/lib/datetime";

export interface ShiftMinutes {
  startMin: number;
  endMin: number;
}

/**
 * The company default when no ShiftAssignment exists — Saturday is a
 * half day (09:00–12:00) for MONTHLY/other staff, every other day (and
 * every day for DAILY_WORKER) is 09:00–18:00.
 *
 * DAILY_WORKER is exempted from the Saturday half-day rule, not the whole
 * company — confirmed 2026-09-24 against real attendance data: 100% of
 * Saturday clock-outs for the daily-wage warehouse team land at 17:00–19:30
 * (a normal full day), zero exceptions across 56 real records. Applying the
 * half-day cutoff to them was crediting a full afternoon of ordinary work as
 * "OT" every Saturday. The half-day default itself is still real for
 * whichever other employment types actually observe it.
 *
 * `workDate` is UTC midnight of the Bangkok calendar date (see
 * lib/datetime.ts's bangkokParts), so getUTCDay() reads the correct weekday.
 */
function defaultShiftFor(workDate: Date, employmentType?: string): ShiftMinutes {
  const isSaturday = workDate.getUTCDay() === 6;
  const isHalfDay = isSaturday && employmentType !== "DAILY_WORKER";
  return { startMin: SHIFT_START_MIN, endMin: isHalfDay ? SATURDAY_SHIFT_END_MIN : SHIFT_END_MIN };
}

function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

async function employmentTypeOf(employeeId: string): Promise<string | undefined> {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { employmentType: true } });
  return e?.employmentType;
}

/**
 * An employee's real shift for one day, if HR scheduled one via "กะการทำงาน"
 * (ShiftAssignment → ShiftTemplate) — falls back to the company default
 * (see defaultShiftFor) when no assignment exists, which is the case for
 * most employees today. Pass `employmentType` when the caller already has
 * it in hand to skip an extra lookup; otherwise it's only fetched on a
 * Saturday (the one case defaultShiftFor actually needs it for).
 */
export async function resolveShiftMinutes(employeeId: string, workDate: Date, employmentType?: string): Promise<ShiftMinutes> {
  const assignment = await prisma.shiftAssignment.findUnique({
    where: { employeeId_date: { employeeId, date: workDate } },
    select: { template: { select: { startTime: true, endTime: true } } },
  });
  if (assignment) {
    return { startMin: parseHHMM(assignment.template.startTime), endMin: parseHHMM(assignment.template.endTime) };
  }
  const type = employmentType ?? (workDate.getUTCDay() === 6 ? await employmentTypeOf(employeeId) : undefined);
  return defaultShiftFor(workDate, type);
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
  employmentType?: string,
): ShiftMinutes {
  return map.get(`${employeeId}|${workDate.toISOString().slice(0, 10)}`) ?? defaultShiftFor(workDate, employmentType);
}
