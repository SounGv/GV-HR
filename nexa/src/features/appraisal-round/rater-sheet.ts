/**
 * What one rater's submitted sheet shows HR on the tracking page: the date it was sent and the score it gave
 * (pure, no imports; checked by `node --experimental-strip-types scripts/check-rater-sheet.mjs`).
 *
 * The score is the plain mean of the rating answers on the sheet as a percent of the scale, the same way Favpo shows one
 * rater's "คะแนนสรุป". It is not the weighted figure the person's result uses, and it never changes a stored score.
 */

export interface SheetQuestion {
  id: string;
  answerType: string;
}

/** Percent (0-100, two decimals) of the scale, or null when the sheet has no rating answer. */
export function sheetPercent(answers: unknown, questions: readonly SheetQuestion[], ratingMax: number): number | null {
  if (!Array.isArray(answers) || ratingMax <= 0) return null;
  const rating = new Set(questions.filter((q) => q.answerType === "RATING").map((q) => q.id));
  const values: number[] = [];
  for (const a of answers as { questionId?: unknown; value?: unknown }[]) {
    if (typeof a?.questionId === "string" && rating.has(a.questionId) && typeof a.value === "number" && a.value >= 1 && a.value <= ratingMax) values.push(a.value);
  }
  if (values.length === 0) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.round((mean / ratingMax) * 10000) / 100;
}
