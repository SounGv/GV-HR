/**
 * Who counts as "using the clock-in app" on a given day. Pure and import-free so it can be checked on its own
 * (`node --experimental-strip-types scripts/check-calendar-activity.mjs`).
 */

const DAY_MS = 86_400_000;

/** Same lookback as the attendance dashboard and the day panel. */
export const ACTIVITY_LOOKBACK_DAYS = 60;

/**
 * True when the person had a clock-in record on `dayMs` or in the ACTIVITY_LOOKBACK_DAYS before it. Someone who first scanned
 * after that day, or who had not scanned for longer than the lookback, has not started using the app yet, so a day with no
 * scan is not an absence for them. `recordDays` are the record dates as UTC-midnight milliseconds, in any order.
 */
export function usedClockInBy(dayMs: number, recordDays: readonly number[]): boolean {
  const from = dayMs - ACTIVITY_LOOKBACK_DAYS * DAY_MS;
  return recordDays.some((t) => t >= from && t <= dayMs);
}
