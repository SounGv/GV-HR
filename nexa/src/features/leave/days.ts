const MS_PER_DAY = 86_400_000;

/** The working week is Monday to Saturday: Sunday is never a leave day. */
export const isSunday = (d: Date): boolean => d.getUTCDay() === 0;

/**
 * Leave days in a request: every day from start to end, Monday to Saturday (Sundays are skipped).
 * A half-day request counts 0.5 on a working day. A request that falls only on Sunday counts 0,
 * which callers must reject. Company holidays are not excluded (not decided yet).
 */
export function computeLeaveDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return isSunday(start) ? 0 : 0.5;
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const total = Math.floor((e - s) / MS_PER_DAY) + 1;
  if (total <= 0) return 0;
  let count = 0;
  for (let i = 0; i < Math.min(total, 1100); i++) {
    if (new Date(s + i * MS_PER_DAY).getUTCDay() !== 0) count++;
  }
  return count;
}

/** Paid leave types deduct from the annual balance; UNPAID/OTHER do not. */
export function deductsBalance(type: string): boolean {
  return type === "ANNUAL" || type === "SICK" || type === "PERSONAL";
}

/** Leave types with an HR-configurable annual quota (see Company.leaveQuota* fields). */
export const PAID_LEAVE_TYPES = ["ANNUAL", "SICK", "PERSONAL"] as const;

/** Leave types that can be requested by the hour instead of by the day. */
export const HOURLY_LEAVE_TYPES = ["SICK", "PERSONAL"] as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for an "HH:mm" string — throws if malformed. */
function parseTimeToMinutes(time: string): number {
  const match = TIME_RE.exec(time);
  if (!match) throw new Error(`Invalid time "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Hours between two "HH:mm" wall-clock times on the same day (e.g. "09:00"→"11:30" = 2.5). */
export function computeLeaveHours(startTime: string, endTime: string): number {
  const minutes = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  return Math.round((minutes / 60) * 100) / 100;
}
