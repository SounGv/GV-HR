/**
 * Which balance an hour-unit leave request uses.
 *
 * HR can give a type its own hour quota (LeaveBalance.totalHours). When it has
 * none, hourly leave comes out of the day balance at {@link HOURS_PER_LEAVE_DAY}
 * hours a day, so someone with 21 sick days left can still take 2 hours off.
 * Kept free of Prisma so the rule can be checked on its own and shared with the
 * leave form.
 */

/** A working day of leave, in hours (same ÷8 payroll uses for hour-unit leave). */
export const HOURS_PER_LEAVE_DAY = 8;

/** The parts of a leave balance this rule needs. */
export interface HourPoolBalance {
  totalDays: number;
  usedDays: number;
  totalHours: number;
  usedHours: number;
}

/**
 * Whether the type has its own hour quota.
 *
 * @param totalHours The balance's hour quota.
 * @returns True when hours are counted separately from days.
 */
export function hasOwnHourQuota(totalHours: number): boolean {
  return totalHours > 0;
}

/**
 * Hours that can still be taken as hourly leave.
 *
 * @param b The balance (or the quota it would start from).
 * @returns Hours left in the hour quota, or the days left × 8 when there is no hour quota.
 */
export function remainingLeaveHours(b: HourPoolBalance): number {
  const hours = hasOwnHourQuota(b.totalHours)
    ? b.totalHours - b.usedHours
    : (b.totalDays - b.usedDays) * HOURS_PER_LEAVE_DAY;
  return Math.max(0, Math.round(hours * 100) / 100);
}

/**
 * How an approved hourly request changes the balance.
 *
 * @param hours Hours in the request.
 * @param totalHours The balance's hour quota.
 * @returns The hours and days to add to "used" (one of them is 0).
 */
export function hourlyUsage(hours: number, totalHours: number): { usedHours: number; usedDays: number } {
  return hasOwnHourQuota(totalHours)
    ? { usedHours: hours, usedDays: 0 }
    : { usedHours: 0, usedDays: Math.round((hours / HOURS_PER_LEAVE_DAY) * 10_000) / 10_000 };
}
