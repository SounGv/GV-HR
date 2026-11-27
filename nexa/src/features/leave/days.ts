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

/** Sick leave longer than this many days in one request needs a medical certificate (owner, 14 Nov 2026). */
export const MEDICAL_CERT_AFTER_DAYS = 2;

/** The first this many sick-leave uses of a year need no medical certificate; the next one does (owner, 28 Nov 2026). */
export const SICK_USES_WITHOUT_CERT = 2;

/**
 * How many times the person has used sick leave in `year`: requests that are waiting or approved (a rejected or cancelled
 * request is not a use), counted per request whatever its length, by the year the leave starts. A waiting request counts so
 * that sending several at once cannot get around the rule.
 */
export function countSickUses(
  requests: readonly { type: string; status: string; startDate: Date | string }[],
  year: number,
): number {
  return requests.filter(
    (r) => r.type === "SICK" && (r.status === "PENDING" || r.status === "APPROVED") && new Date(r.startDate).getUTCFullYear() === year,
  ).length;
}

/**
 * Whether this request has to carry a medical certificate before it can be sent. Either rule asks for one:
 * the request is sick leave of more than {@link MEDICAL_CERT_AFTER_DAYS} days (hourly sick leave is within one day, so
 * this part never applies to it), or it is the {@link SICK_USES_WITHOUT_CERT}+1 th use of sick leave this year or later.
 * @param priorSickUses sick-leave uses already made this year (countSickUses), not counting this request
 */
export function needsMedicalCertificate(type: string, unit: string | undefined, days: number | null, priorSickUses = 0): boolean {
  if (type !== "SICK") return false;
  if (priorSickUses >= SICK_USES_WITHOUT_CERT) return true;
  return unit !== "HOUR" && days != null && days > MEDICAL_CERT_AFTER_DAYS;
}

export const MEDICAL_CERT_MESSAGE = `ลาป่วยเกิน ${MEDICAL_CERT_AFTER_DAYS} วัน ต้องแนบใบรับรองแพทย์ก่อนส่งคำขอ`;
export const MEDICAL_CERT_NTH_MESSAGE = `ลาป่วยครั้งที่ ${SICK_USES_WITHOUT_CERT + 1} ของปีนี้เป็นต้นไป ต้องแนบใบรับรองแพทย์ก่อนส่งคำขอ`;

/** The message that says why the certificate is needed: the yearly count when it applies, else the length of the request. */
export function medicalCertMessage(priorSickUses: number): string {
  return priorSickUses >= SICK_USES_WITHOUT_CERT ? MEDICAL_CERT_NTH_MESSAGE : MEDICAL_CERT_MESSAGE;
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

/**
 * Leave days of a request that fall inside a payroll period, Sundays skipped
 * the same way computeLeaveDays counts them.
 *
 * @param start First day of the request.
 * @param end Last day of the request.
 * @param from First day of the period.
 * @param toExclusive The day after the period.
 * @returns Working days (Mon-Sat) of the request inside the period.
 */
export function leaveDaysWithin(start: Date, end: Date, from: Date, toExclusive: Date): number {
  const clipStart = start < from ? from : start;
  const lastInPeriod = new Date(toExclusive.getTime() - MS_PER_DAY);
  const clipEnd = end > lastInPeriod ? lastInPeriod : end;
  if (clipEnd < clipStart) return 0;
  return computeLeaveDays(clipStart, clipEnd, false);
}

/** Whether two same-day "HH:mm" ranges share any minute (touching ends do not count). */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return parseTimeToMinutes(aStart) < parseTimeToMinutes(bEnd) && parseTimeToMinutes(bStart) < parseTimeToMinutes(aEnd);
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
