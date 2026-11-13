/**
 * Pure helpers for the dashboard charts (no imports, so scripts/check-chart-math.mjs can run them).
 * Approved mock: charts-placement-mock.html in the HR&PAYROLL root.
 */

export interface TrendInput {
  label: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

export interface TrendDay {
  label: string;
  /** People who clocked in that day. */
  present: number;
  late: number;
  /** Clearly fewer people at work than the period's usual: gets the red dot and its value. */
  low: boolean;
  /** Clearly more late people than usual: gets the solid amber bar and its count. */
  lateHigh: boolean;
}

export interface TrendStats {
  days: TrendDay[];
  avgPresent: number;
  avgLate: number;
  /** Index of the day with the fewest people among the low ones, or -1 when no day is low. */
  worst: number;
}

/** A day is "low" when it has this share fewer people than the average, and at least LOW_MIN_GAP people fewer. */
export const LOW_SHARE = 0.1;
export const LOW_MIN_GAP = 2;
/** How many people above the average late count a day must be to count as "late high". */
export const HIGH_LATE_GAP = 2;

/**
 * Marks only the days that clearly differ from the period's own average, so a
 * quiet chart stays quiet. Counts people who clocked in rather than a % of
 * headcount: many staff never use the clock-in app, so a % of everyone reads
 * as half the company missing. The thresholds are a design default, not a
 * company policy: swap them for HR's target once one is agreed.
 */
export function trendStats(points: TrendInput[]): TrendStats {
  const days: TrendDay[] = points.map((p) => ({ label: p.label, present: p.present, late: p.late, low: false, lateHigh: false }));
  const n = days.length;
  const avgPresent = n ? days.reduce((s, d) => s + d.present, 0) / n : 0;
  const avgLate = n ? days.reduce((s, d) => s + d.late, 0) / n : 0;
  const lowGap = Math.max(LOW_MIN_GAP, avgPresent * LOW_SHARE);
  let worst = -1;
  days.forEach((d, i) => {
    d.low = n > 1 && d.present < avgPresent - lowGap;
    d.lateHigh = n > 1 && d.late > avgLate + HIGH_LATE_GAP;
    if (d.low && (worst < 0 || d.present < days[worst].present)) worst = i;
  });
  return { days, avgPresent, avgLate, worst };
}

/** A round axis top above `max`: 5, 10, 20, 25, 50 … steps so the ticks read cleanly. */
export function niceCeiling(max: number): number {
  if (max <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/**
 * SVG path through the points with a smooth curve that never overshoots a real
 * value (monotone cubic, Fritsch–Carlson). Points must share one x step.
 */
export function monotonePath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  const n = points.length;
  const dx = points[1][0] - points[0][0];
  const m: number[] = [];
  for (let k = 0; k < n - 1; k++) m.push((points[k + 1][1] - points[k][1]) / dx);
  const t: number[] = [m[0]];
  for (let k = 1; k < n - 1; k++) t.push(m[k - 1] * m[k] <= 0 ? 0 : (m[k - 1] + m[k]) / 2);
  t.push(m[n - 2]);
  for (let k = 0; k < n - 1; k++) {
    if (m[k] === 0) {
      t[k] = 0;
      t[k + 1] = 0;
      continue;
    }
    const a = t[k] / m[k];
    const b = t[k + 1] / m[k];
    const q = a * a + b * b;
    if (q > 9) {
      const tau = 3 / Math.sqrt(q);
      t[k] = tau * a * m[k];
      t[k + 1] = tau * b * m[k];
    }
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  let d = `M${r(points[0][0])},${r(points[0][1])}`;
  for (let k = 0; k < n - 1; k++) {
    const [x0, y0] = points[k];
    const [x1, y1] = points[k + 1];
    d += ` C${r(x0 + dx / 3)},${r(y0 + (t[k] * dx) / 3)} ${r(x1 - dx / 3)},${r(y1 - (t[k + 1] * dx) / 3)} ${r(x1)},${r(y1)}`;
  }
  return d;
}

/** Widths in % for a stacked bar; all zero when the total is zero. */
export function stackPercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  return values.map((v) => (total > 0 ? (Math.max(0, v) / total) * 100 : 0));
}
