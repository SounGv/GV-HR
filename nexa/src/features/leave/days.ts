const MS_PER_DAY = 86_400_000;

/**
 * Inclusive calendar-day count for a leave request. A half-day request always
 * counts as 0.5. (A future Shift/Holiday integration can exclude weekends and
 * public holidays here without changing callers.)
 */
export function computeLeaveDays(start: Date, end: Date, halfDay: boolean): number {
  if (halfDay) return 0.5;
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.floor((e - s) / MS_PER_DAY) + 1);
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
