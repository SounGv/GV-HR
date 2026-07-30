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

/** Default annual quota (days) per leave type, used when a balance row is first created. */
export const DEFAULT_QUOTA: Record<string, number> = {
  ANNUAL: 10,
  SICK: 30,
  PERSONAL: 3,
  UNPAID: 0,
  OTHER: 0,
};
