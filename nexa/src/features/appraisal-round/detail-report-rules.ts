/**
 * Small pure helpers for the detailed evaluation report (no imports; checked by
 * `node --experimental-strip-types scripts/check-detail-report.mjs`).
 */

export const r1 = (n: number) => Math.round(n * 10) / 10;

/** Plain mean rounded to one decimal, or null for an empty list. */
export function meanOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : r1(values.reduce((s, v) => s + v, 0) / values.length);
}

/** Competition ranking from the highest: equal scores share a rank and the next rank skips (100, 100, 90 is 1, 1, 3). */
export function ranksFor(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.indexOf(v) + 1);
}

/** Difference to one decimal, or null when either side is missing. */
export function deltaOf(now: number | null, before: number | null): number | null {
  return now === null || before === null ? null : r1(now - before);
}

export interface ScoredRow {
  roundId: string;
  employeeId: string;
  department: string;
  score: number;
}

export interface RoundStamp {
  id: string;
  /** Sortable time the round started (milliseconds). */
  at: number;
}

/**
 * The score a person got in the nearest round before `roundId` (rounds are compared by time), or null when they
 * were not scored in an earlier round.
 */
export function previousScore(rows: readonly ScoredRow[], rounds: readonly RoundStamp[], roundId: string, employeeId: string): number | null {
  const at = rounds.find((r) => r.id === roundId)?.at;
  if (at === undefined) return null;
  const earlier = rounds.filter((r) => r.at < at).sort((a, b) => b.at - a.at);
  for (const r of earlier) {
    const hit = rows.find((x) => x.roundId === r.id && x.employeeId === employeeId);
    if (hit) return hit.score;
  }
  return null;
}

/** The mean of a department in the nearest earlier round where it has anyone scored. */
export function previousDepartmentMean(rows: readonly ScoredRow[], rounds: readonly RoundStamp[], roundId: string, department: string): number | null {
  const at = rounds.find((r) => r.id === roundId)?.at;
  if (at === undefined) return null;
  const earlier = rounds.filter((r) => r.at < at).sort((a, b) => b.at - a.at);
  for (const r of earlier) {
    const m = meanOf(rows.filter((x) => x.roundId === r.id && x.department === department).map((x) => x.score));
    if (m !== null) return m;
  }
  return null;
}

/** Mean percent (0-100) per section over rating answers; sections with no rating answer are left out. */
export function sectionPercents(
  questions: readonly { id: string; answerType: string; section?: string | null }[],
  sheets: readonly { questionId?: unknown; value?: unknown }[][],
  ratingMax: number,
): Map<string, number> {
  const section = new Map(questions.filter((q) => q.answerType === "RATING").map((q) => [q.id, q.section?.trim() || "ทั่วไป"]));
  const sums = new Map<string, number[]>();
  for (const sheet of sheets) {
    for (const a of sheet) {
      if (typeof a.questionId !== "string" || typeof a.value !== "number") continue;
      const sec = section.get(a.questionId);
      if (!sec || a.value < 1 || a.value > ratingMax) continue;
      sums.set(sec, [...(sums.get(sec) ?? []), (a.value / ratingMax) * 100]);
    }
  }
  const out = new Map<string, number>();
  for (const [k, v] of sums) out.set(k, r1(v.reduce((s, x) => s + x, 0) / v.length));
  return out;
}
