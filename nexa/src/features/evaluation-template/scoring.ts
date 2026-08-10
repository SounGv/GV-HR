import type { TemplateSection } from "./types";

export interface TemplateAnswer {
  questionId: string;
  value: string;
}

/**
 * Weighted average of every non-LONG_TEXT answer's resolved option score,
 * mirroring the legacy Competency scoring formula in campaign/service.ts —
 * kept as a standalone function (rather than folded into that file) since
 * it operates on a frozen templateSnapshot, not live Competency rows.
 */
export function scoreTemplateAnswers(sections: TemplateSection[], answers: TemplateAnswer[]): number {
  const questions = new Map(sections.flatMap((s) => s.questions.map((q) => [q.id, q])));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const a of answers) {
    const question = questions.get(a.questionId);
    if (!question || question.answerType === "LONG_TEXT") continue;
    const option = question.options?.find((o) => o.value === a.value);
    if (!option) continue;
    weightedSum += option.score * question.weight;
    totalWeight += question.weight;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}
