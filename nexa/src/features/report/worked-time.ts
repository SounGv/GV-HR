/**
 * Worked time for staff paid by the day, shown in the daily attendance report so HR can type the pay for a part day by hand
 * (owner, 27 Nov 2026: the system shows the hours, HR enters the money). Nothing here touches payroll.
 */

/** A full day is this many net hours (the same 8 the unpaid-hour rate already divides a day by, see payroll unpaidHourRate). */
export const FULL_DAY_HOURS = 8;
/** One fixed lunch break comes off a day longer than {@link BREAK_AFTER_HOURS}; nobody records the break in the scan app (0 of 215 records in Nov 2026). */
export const LUNCH_BREAK_MINUTES = 60;
export const BREAK_AFTER_HOURS = 5;
/** Net time is rounded down to this many minutes. */
export const ROUND_DOWN_MINUTES = 15;

/** Paid by the day: a daily worker, or anyone whose pay type is DAILY. */
export function isPaidByDay(employmentType: string, compensationType: string | null | undefined): boolean {
  return employmentType === "DAILY_WORKER" || compensationType === "DAILY";
}

/**
 * Net worked hours: clock-out minus clock-in, less the fixed lunch break on a long day, rounded down to 15 minutes.
 * Null when either scan is missing or the clock-out is not after the clock-in.
 */
export function netWorkedHours(clockInAt: Date | null, clockOutAt: Date | null): number | null {
  if (!clockInAt || !clockOutAt) return null;
  const spanMin = (clockOutAt.getTime() - clockInAt.getTime()) / 60_000;
  if (spanMin <= 0) return null;
  const netMin = spanMin > BREAK_AFTER_HOURS * 60 ? spanMin - LUNCH_BREAK_MINUTES : spanMin;
  return Math.floor(Math.max(netMin, 0) / ROUND_DOWN_MINUTES) * (ROUND_DOWN_MINUTES / 60);
}

export type DayKind = "ครบวัน" | "ไม่เต็มวัน" | "ลืมสแกนออก";

/** What HR needs to see per day: a full day, a part day (type the pay by hand), or a day to fix first. */
export function dayKindOf(clockInAt: Date | null, clockOutAt: Date | null): DayKind | null {
  if (!clockInAt) return null;
  const net = netWorkedHours(clockInAt, clockOutAt);
  if (net === null) return "ลืมสแกนออก";
  return net >= FULL_DAY_HOURS ? "ครบวัน" : "ไม่เต็มวัน";
}
