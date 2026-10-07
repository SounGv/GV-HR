export const DEFAULT_MULTIPLIER = 1.5;
/** Working on a day off (a holiday or an off Saturday) is paid at double rate (the rate HR gave for this). */
export const DAY_OFF_MULTIPLIER = 2;

export const OT_DAY_TYPES = ["NORMAL", "DAY_OFF"] as const;
export type OtDayType = (typeof OT_DAY_TYPES)[number];

/** Pay multiplier for the kind of day an OT request is for. */
export const multiplierFor = (dayType: OtDayType): number => (dayType === "DAY_OFF" ? DAY_OFF_MULTIPLIER : DEFAULT_MULTIPLIER);

/**
 * Why a date counts as a day off, or null for an ordinary working day.
 * A company holiday wins over Sunday so the reason names the holiday. An off
 * Saturday is not detected here — the system does not know it yet, so the
 * employee picks the day-off type by hand for that case.
 *
 * @param date Calendar date as "YYYY-MM-DD" (the value of a date input).
 * @param holidays Company holidays; each `date` starts with "YYYY-MM-DD".
 */
export function dayOffReason(date: string, holidays: ReadonlyArray<{ date: string; name: string }> = []): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const holiday = holidays.find((h) => h.date.slice(0, 10) === date);
  if (holiday) return `เป็นวันหยุด “${holiday.name}”`;
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? "เป็นวันอาทิตย์" : null;
}

/** Below this, a clock-out a few minutes past shift end is just clock-skew
 * noise, not real overtime worth an approval record. Shared by the
 * attendance import's inline OT generation and the standalone attendance→OT
 * reconciliation pass. */
export const MIN_OT_MINUTES = 15;

/**
 * Minutes elapsed between the Bangkok midnight that begins `workDate` and
 * `clockOutAt` (a real UTC instant) — correctly handles a clock-out that
 * lands on the calendar day AFTER workDate (an overnight shift). A plain
 * "minutes since midnight of clockOutAt's own day" calculation wraps back to
 * a small number for an after-midnight clock-out (e.g. 00:20 → 20), which
 * then computes as far *less* than the shift end instead of hours past it,
 * silently dropping real overtime instead of crediting it.
 * `workDate` must be UTC midnight of the Bangkok calendar date (see
 * lib/datetime.ts's bangkokParts.dateUTC) — Bangkok is UTC+7 with no DST.
 */
export function minutesSinceWorkDateStart(clockOutAt: Date, workDate: Date): number {
  const bangkokMidnightUtcMs = workDate.getTime() - 7 * 60 * 60 * 1000;
  return Math.round((clockOutAt.getTime() - bangkokMidnightUtcMs) / 60000);
}

export function parseHM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** OT hours between two "HH:mm" times (0 if end <= start). 2 dp. */
export function computeHours(start: string, end: string): number {
  const diff = parseHM(end) - parseHM(start);
  if (diff <= 0) return 0;
  return Math.round((diff / 60) * 100) / 100;
}

/**
 * Estimated OT pay: hourly wage × multiplier × hours. The hourly wage
 * depends on how this employee is actually paid (compensationType) — a
 * MONTHLY salary is amortized over 30 days × 8 hours, a DAILY rate over
 * 8 hours, and an HOURLY rate is already per-hour. Using baseSalary alone
 * regardless of pay type silently priced every daily/hourly-wage
 * employee's OT at ฿0 (their baseSalary is null), which is most of the
 * workforce here.
 *
 * OT hours are credited in half-hour blocks, rounded to the nearest 0.5 —
 * confirmed against HR's own manual payroll sheet (e.g. a 20-minute excess
 * pays as 0.5h, a 63-minute excess pays as 1.0h, not the exact-minute
 * fraction). `hours` itself (what's stored/displayed on the request) stays
 * the real clocked duration; only the money calculation rounds.
 */
export function estimateAmount(
  compensation: {
    compensationType: "MONTHLY" | "DAILY" | "HOURLY" | string;
    baseSalary: number | null | undefined;
    dailyRate: number | null | undefined;
    hourlyRate: number | null | undefined;
  },
  hours: number,
  multiplier: number,
): number {
  let hourly: number;
  if (compensation.compensationType === "DAILY") {
    if (!compensation.dailyRate) return 0;
    hourly = compensation.dailyRate / 8;
  } else if (compensation.compensationType === "HOURLY") {
    if (!compensation.hourlyRate) return 0;
    hourly = compensation.hourlyRate;
  } else {
    if (!compensation.baseSalary) return 0;
    hourly = compensation.baseSalary / 30 / 8;
  }
  const billedHours = Math.round(hours * 2) / 2;
  return Math.round(hourly * multiplier * billedHours);
}
