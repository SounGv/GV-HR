// Pure helpers for sessions that run past midnight. No imports, so scripts/check-attendance-overnight.mjs can run them.

/** A session opened more than this long ago is a forgotten clock-out, not a shift still running. */
export const OPEN_SESSION_MAX_MIN = 16 * 60;

/** Minutes from Bangkok midnight of `workDate` (UTC midnight of the Bangkok date) to `at`. Bangkok is UTC+7, no DST. */
export function minutesSinceWorkDate(at: Date, workDate: Date): number {
  return Math.floor((at.getTime() - (workDate.getTime() - 7 * 60 * 60 * 1000)) / 60000);
}

/**
 * Shift end as minutes since the start of the work date. A shift that ends at or before its start
 * (22:00 to 06:00) ends the next day, so 24 hours are added. A normal day shift is returned as is.
 */
export function shiftEndFromWorkDateStart(shift: { startMin: number; endMin: number }): number {
  return shift.endMin <= shift.startMin ? shift.endMin + 24 * 60 : shift.endMin;
}

/** Early leave measured from the start of the work date, so a clock-out after midnight is not read as 00:30 against an 18:00 end. */
export function isEarlyLeaveElapsed(
  elapsedMin: number,
  shift: { startMin: number; endMin: number },
  graceMin: number,
): boolean {
  return elapsedMin < shiftEndFromWorkDateStart(shift) - graceMin;
}

/** True when a record opened on the previous date is recent enough to still be the person's running shift. */
export function isOpenSessionCurrent(clockInAt: Date, now: Date): boolean {
  const open = now.getTime() - clockInAt.getTime();
  return open >= 0 && open <= OPEN_SESSION_MAX_MIN * 60000;
}
