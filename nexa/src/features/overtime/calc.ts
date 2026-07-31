export const DEFAULT_MULTIPLIER = 1.5;

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
 * Estimated OT pay: hourly wage × multiplier × hours.
 * Hourly wage ≈ monthly salary / 30 days / 8 hours.
 */
export function estimateAmount(
  baseSalary: number | null | undefined,
  hours: number,
  multiplier: number,
): number {
  if (!baseSalary) return 0;
  const hourly = baseSalary / 30 / 8;
  return Math.round(hourly * multiplier * hours);
}
