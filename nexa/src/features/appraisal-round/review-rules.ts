/**
 * Rules of the review page ("ทบทวนผล"): grade spread, how generously each manager scores, and the flags beside each
 * person (pure, no imports; checked by `node --experimental-strip-types scripts/check-appraisal-review.mjs`).
 *
 * Read-only. Nothing here changes a score, a grade or a band: it only counts and compares what is already stored, so HR
 * can look before approving. The two warning gaps below are placeholders until HR confirms them.
 */

/** A manager whose average differs from the company by more than this many points gets a "ควรตรวจ" warning. Confirmed by the owner 15 Nov 2026 (start here, review after the first real round). */
export const MANAGER_GAP_POINTS = 10;
/** Self score above the manager's by at least this many points gets "ควรคุย". Placeholder, HR to confirm. */
export const SELF_GAP_POINTS = 10;
/** A manager who rated fewer people than this has no average shown (it would point at individuals). */
export const MIN_PEOPLE_PER_MANAGER = 3;
/** A score this close to a grade boundary (either side) is flagged, since a small change moves the grade. */
export const NEAR_EDGE_POINTS = 1;

/** At least this many people must be scored before "many at the top score" is worth saying (a handful of 100s is normal). */
export const CEILING_MIN_PEOPLE = 5;
/** Share of people at the top score from which the review page warns that scores bunch at the ceiling. Warning only. */
export const CEILING_SHARE = 0.5;

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface CeilingSummary {
  /** People at the top score (100% by default). */
  count: number;
  total: number;
  /** True when enough people were scored and at least CEILING_SHARE of them are at the top, so scores cannot tell people apart. */
  flag: boolean;
}

/**
 * How many people sit at the top score. Informational: it never changes a score or a grade, and it does not depend on
 * grade bands being set, so it also works before HR has chosen any.
 *
 * @param percents each scored person's total, 0 to 100.
 * @param top the score counted as the ceiling.
 */
export function ceilingSummary(percents: readonly number[], top = 100): CeilingSummary {
  const count = percents.filter((p) => p >= top).length;
  const total = percents.length;
  return { count, total, flag: total >= CEILING_MIN_PEOPLE && count / total >= CEILING_SHARE };
}

export interface BandLike {
  label: string;
  minPercent: number;
}

/** Bands from the highest threshold down, so counts line up with how grades are given. */
export const bandsHighToLow = (bands: readonly BandLike[]): BandLike[] => [...bands].sort((a, b) => b.minPercent - a.minPercent);

/**
 * How many people fall in each band, in the same order as `bandsHighToLow`.
 * People whose score is below every band (when the lowest band does not start at 0) are counted in `below`.
 */
export function gradeSpread(percents: readonly number[], bands: readonly BandLike[]): { counts: number[]; below: number } {
  const sorted = bandsHighToLow(bands);
  const counts = sorted.map(() => 0);
  let below = 0;
  for (const p of percents) {
    const i = sorted.findIndex((b) => p >= b.minPercent);
    if (i === -1) below++;
    else counts[i]++;
  }
  return { counts, below };
}

/** True when `percent` is within `NEAR_EDGE_POINTS` of the start of a band other than the lowest. */
export function nearBandEdge(percent: number, bands: readonly BandLike[]): boolean {
  return bands.filter((b) => b.minPercent > 0).some((b) => Math.abs(percent - b.minPercent) < NEAR_EDGE_POINTS);
}

export interface PersonFlags {
  /** Self minus manager, null when either is missing. */
  gap: number | null;
  talk: boolean;
  nearEdge: boolean;
}

export function personFlags(self: number | null, manager: number | null, total: number, bands: readonly BandLike[]): PersonFlags {
  const gap = self !== null && manager !== null ? r1(self - manager) : null;
  return { gap, talk: gap !== null && gap >= SELF_GAP_POINTS, nearEdge: nearBandEdge(total, bands) };
}

export type ManagerStatus = "ok" | "high" | "low" | "few";

export interface ManagerRow {
  managerId: string;
  name: string;
  /** People this manager has rated (answers submitted). */
  count: number;
  /** Null when `status` is "few". */
  average: number | null;
  /** Average minus the company average, null when `status` is "few". */
  diff: number | null;
  status: ManagerStatus;
}

/**
 * Each manager's average of the percentages they gave, set against everyone's average.
 * The company figure is the average over all given percentages, including managers whose own row is hidden,
 * so hiding a small group never changes the comparison.
 */
export function summarizeManagers(
  given: readonly { managerId: string; name: string; percents: readonly number[] }[],
): { rows: ManagerRow[]; companyAverage: number | null } {
  const all = given.flatMap((g) => g.percents);
  const companyAverage = all.length ? r1(all.reduce((s, p) => s + p, 0) / all.length) : null;
  const rows = given
    .filter((g) => g.percents.length > 0)
    .map((g): ManagerRow => {
      const count = g.percents.length;
      if (count < MIN_PEOPLE_PER_MANAGER || companyAverage === null) return { managerId: g.managerId, name: g.name, count, average: null, diff: null, status: "few" };
      const average = r1(g.percents.reduce((s, p) => s + p, 0) / count);
      const diff = r1(average - companyAverage);
      const status: ManagerStatus = diff > MANAGER_GAP_POINTS ? "high" : diff < -MANAGER_GAP_POINTS ? "low" : "ok";
      return { managerId: g.managerId, name: g.name, count, average, diff, status };
    });
  // Warnings first, then the biggest team, so the rows that need a look are at the top.
  const rank: Record<ManagerStatus, number> = { high: 0, low: 0, ok: 1, few: 2 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || b.count - a.count || a.name.localeCompare(b.name, "th"));
  return { rows, companyAverage };
}
