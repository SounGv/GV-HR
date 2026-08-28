export const DEFAULT_MULTIPLIER = 1.5;

/** Below this, a clock-out a few minutes past shift end is just clock-skew
 * noise, not real overtime worth an approval record. Shared by the
 * attendance import's inline OT generation and the standalone attendance→OT
 * reconciliation pass. */
export const MIN_OT_MINUTES = 15;

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
