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

/**
 * Whether this person may take this leave type by the hour.
 *
 * Sick and personal leave by the hour come out of the quota. Unpaid leave by
 * the hour has no quota and is open to everyone (owner's call, 2026-11-12):
 * payroll takes the hours off at the hourly value of the person's pay (see
 * payroll/service.ts unpaidHourRate).
 *
 * @param type The leave type.
 */
export function canTakeHourly(type: string): boolean {
  return (HOURLY_LEAVE_TYPES as readonly string[]).includes(type) || type === "UNPAID";
}

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

/**
 * `startTime` plus a whole number of hours, as "HH:mm" — used by the leave
 * form's single "ลา N ชั่วโมง" picker to derive `endTime` from `startTime`
 * without a second time picker. Clamped to 23:59 rather than wrapping past
 * midnight: a leave request never spans into the next day (see the
 * same-day refine in schema.ts).
 */
export function addHoursToTime(startTime: string, hours: number): string {
  const minutes = Math.min(23 * 60 + 59, parseTimeToMinutes(startTime) + Math.round(hours * 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
