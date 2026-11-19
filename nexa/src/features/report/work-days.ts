/**
 * Working-day arithmetic for the attendance reports (pure, no imports; checked by
 * `node --experimental-strip-types scripts/check-report-work-days.mjs`). All days are YYYY-MM-DD strings,
 * so a Bangkok calendar date never shifts with the server clock. These are report counts, not pay.
 */

const DAY_MS = 86_400_000;
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Every calendar day from `startIso` through `endIso`, both inclusive. */
export function daysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const last = Date.parse(`${endIso}T00:00:00Z`);
  for (let t = Date.parse(`${startIso}T00:00:00Z`); t <= last; t += DAY_MS) out.push(isoOf(t));
  return out;
}

/** Monday to Friday days of the range that are not holidays and not after today (a day that has not happened cannot be missed). */
export function workingDays(startIso: string, endIso: string, todayIso: string, holidays: ReadonlySet<string>): string[] {
  const last = endIso < todayIso ? endIso : todayIso;
  if (last < startIso) return [];
  return daysBetween(startIso, last).filter((d) => {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    return dow !== 0 && dow !== 6 && !holidays.has(d);
  });
}

/** The working days one person was employed: from the hire date, and up to the termination date when there is one. */
export function employedDays(days: readonly string[], hireIso: string | null | undefined, terminationIso: string | null | undefined): string[] {
  return days.filter((d) => (!hireIso || d >= hireIso) && (!terminationIso || d <= terminationIso));
}

/**
 * How much of each of the person's working days one approved leave covers: 1, or 0.5 for a half day. Days that are
 * not in `days` (weekends, holidays, the future, before hire) are skipped, so a leave that runs past the report range
 * only counts the working days inside it.
 */
export function leaveCover(leave: { startIso: string; endIso: string; halfDay: boolean }, days: ReadonlySet<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of daysBetween(leave.startIso, leave.endIso)) {
    if (days.has(d)) out.set(d, leave.halfDay ? 0.5 : 1);
  }
  return out;
}

/** Absent working days: a day is missed by whatever a scan (1) and approved leave (up to 1) do not cover. */
export function absentDays(days: readonly string[], punched: ReadonlySet<string>, cover: ReadonlyMap<string, number>): number {
  let absent = 0;
  for (const d of days) absent += Math.max(0, 1 - (punched.has(d) ? 1 : 0) - (cover.get(d) ?? 0));
  return absent;
}
