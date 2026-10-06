/**
 * Pure scoring for one person in an appraisal round (no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-scoring.mjs`).
 *
 * Nothing here decides policy: the mode, the perspective weights and the grade bands all come from
 * what HR configured. A score is a percentage (rating / top of the scale, weighted), so results stay
 * comparable even if the scale changes between years.
 */

export type CalcMode = "WEIGHTED" | "SIMPLE";

export interface ScoredQuestion {
  id: string;
  answerType: string;
  weight: number;
  /** Rater types that are asked this question; empty means everyone. */
  visibleTo: string[];
}

export interface RaterAnswers {
  raterType: string;
  answers: { questionId: string; value: unknown }[];
}

export interface Band {
  label: string;
  /** Lowest percentage that earns this grade. */
  minPercent: number;
}

export interface TypeResult {
  raterType: string;
  /** Raters of this type who answered at least one rating question. */
  raters: number;
  percent: number;
  /** Weight the perspective carried in the overall number (after leaving out types with no answers). */
  weightUsed: number;
}

export interface PersonResult {
  scorePercent: number;
  overallScore: number;
  grade: string | null;
  mode: CalcMode;
  types: TypeResult[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** One rater's percentage of the top score, or null when they gave no rating at all. */
export function raterPercent(
  questions: readonly ScoredQuestion[],
  raterType: string,
  answers: RaterAnswers["answers"],
  ratingMax: number,
  mode: CalcMode,
): number | null {
  const asked = new Map(
    questions.filter((q) => q.answerType === "RATING" && (q.visibleTo.length === 0 || q.visibleTo.includes(raterType))).map((q) => [q.id, q]),
  );
  let earned = 0;
  let possible = 0;
  for (const a of answers) {
    const q = asked.get(a.questionId);
    const score = typeof a.value === "number" ? a.value : Number(a.value);
    if (!q || !Number.isFinite(score) || score < 1 || score > ratingMax) continue;
    const w = mode === "SIMPLE" ? 1 : q.weight;
    earned += w * (score / ratingMax);
    possible += w;
  }
  return possible > 0 ? (earned / possible) * 100 : null;
}

/** The highest band the percentage reaches, or null when there are no bands or none is reached. */
export function gradeFor(percent: number, bands: readonly Band[] | null | undefined): string | null {
  if (!bands || bands.length === 0) return null;
  const hit = [...bands].sort((a, b) => b.minPercent - a.minPercent).find((b) => percent >= b.minPercent);
  return hit ? hit.label : null;
}

/**
 * Overall result for one person. Rater types with no usable answers are left out and the remaining
 * perspective weights are re-balanced; if none of the answering types has a weight, they count equally.
 * Returns null when nobody has given a rating yet.
 */
export function computeResult(input: {
  questions: readonly ScoredQuestion[];
  ratingMax: number;
  raters: readonly RaterAnswers[];
  perspectiveWeights: Partial<Record<string, number>>;
  mode: CalcMode;
  bands?: readonly Band[] | null;
}): PersonResult | null {
  const byType = new Map<string, number[]>();
  for (const r of input.raters) {
    const p = raterPercent(input.questions, r.raterType, r.answers, input.ratingMax, input.mode);
    if (p === null) continue;
    byType.set(r.raterType, [...(byType.get(r.raterType) ?? []), p]);
  }
  if (byType.size === 0) return null;

  const rows = [...byType.entries()].map(([raterType, ps]) => ({
    raterType,
    raters: ps.length,
    percent: ps.reduce((s, p) => s + p, 0) / ps.length,
    weight: input.perspectiveWeights[raterType] ?? 0,
  }));
  const weightSum = rows.reduce((s, r) => s + r.weight, 0);
  const equal = weightSum === 0;
  const total = equal ? rows.length : weightSum;
  const overall = rows.reduce((s, r) => s + r.percent * (equal ? 1 : r.weight), 0) / total;

  const scorePercent = r1(overall);
  return {
    scorePercent,
    overallScore: r2((overall / 100) * input.ratingMax),
    grade: gradeFor(scorePercent, input.bands),
    mode: input.mode,
    types: rows.map((r) => ({
      raterType: r.raterType,
      raters: r.raters,
      percent: r1(r.percent),
      weightUsed: r1(((equal ? 1 : r.weight) / total) * 100),
    })),
  };
}

/** Bands must have a label and a percentage from 0 to 100, with no two bands starting at the same point. */
export function bandsProblem(bands: readonly Band[]): string | null {
  if (bands.length > 10) return "แบ่งระดับได้ไม่เกิน 10 ระดับ";
  const seen = new Set<number>();
  for (const b of bands) {
    if (!b.label.trim()) return "ทุกระดับต้องมีชื่อ";
    if (!(b.minPercent >= 0 && b.minPercent <= 100)) return "เปอร์เซ็นต์ต้องอยู่ระหว่าง 0–100";
    if (seen.has(b.minPercent)) return "มีระดับที่เริ่มที่เปอร์เซ็นต์เดียวกัน";
    seen.add(b.minPercent);
  }
  return null;
}
