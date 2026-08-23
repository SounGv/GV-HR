import type { CampaignTemplateSnapshot } from "@/features/evaluation-template/types";
import type { EvaluationScoreStatus } from "@prisma/client";

export interface ScoreTopic {
  key: string;
  label: string;
  score: number;
  maxScore: number;
}

export interface ScoreBreakdown {
  rawScore: number;
  maxScore: number;
  /** Weighted 0-100 percent — SUM((score/maxScore)*weight), where each
   * question/competency's weight is already expressed as a percentage-point
   * share of the whole (template weights are validated to sum to 100 at
   * save time; the legacy Competency path just takes whatever weights the
   * campaign was given, same as it always has). */
  scorePercent: number;
  questionCount: number;
  /** Ascending by achieved ratio — worst first, capped to the 3 lowest for
   * the auto-generated improvement plan / dashboard "หัวข้อคะแนนต่ำสุด". */
  lowestTopics: ScoreTopic[];
}

const NON_SCORING_TYPES = new Set(["LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"]);

function finish(rawScore: number, maxScore: number, weightedPercent: number, questionCount: number, topics: ScoreTopic[]): ScoreBreakdown {
  topics.sort((a, b) => (a.maxScore ? a.score / a.maxScore : 0) - (b.maxScore ? b.score / b.maxScore : 0));
  return {
    rawScore: Math.round(rawScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    scorePercent: Math.round(weightedPercent * 100) / 100,
    questionCount,
    lowestTopics: topics.slice(0, 3),
  };
}

/** Template-based path — mirrors scoreTemplateAnswers's matching logic but
 * also returns the raw/max/percent/lowest-topics breakdown instead of just
 * one averaged number. */
export function scoreTemplateAnswersDetailed(
  sections: CampaignTemplateSnapshot["sections"],
  answers: { questionId: string; value: string }[],
): ScoreBreakdown {
  const questions = new Map(sections.flatMap((s) => s.questions.map((q) => [q.id, q])));
  let rawScore = 0;
  let maxScore = 0;
  let weightedPercent = 0;
  let questionCount = 0;
  const topics: ScoreTopic[] = [];

  for (const a of answers) {
    const question = questions.get(a.questionId);
    if (!question || NON_SCORING_TYPES.has(question.answerType)) continue;
    const option = question.options?.find((o) => o.value === a.value);
    if (!option) continue;
    const qMax = question.options && question.options.length > 0 ? Math.max(...question.options.map((o) => o.score)) : 0;

    rawScore += option.score;
    maxScore += qMax;
    weightedPercent += qMax > 0 ? (option.score / qMax) * question.weight : 0;
    questionCount++;
    topics.push({ key: question.id, label: question.text, score: option.score, maxScore: qMax });
  }

  return finish(rawScore, maxScore, weightedPercent, questionCount, topics);
}

/** Legacy Competency-based path — same shape, driven by each competency's
 * own maxScore (default 5) rather than a template question's option max. */
export function scoreCompetenciesDetailed(
  raterScores: { competencyId: string; score: number }[],
  competencyMeta: Map<string, { name: string; weight: number; maxScore: number }>,
): ScoreBreakdown {
  let rawScore = 0;
  let maxScore = 0;
  let weightedPercent = 0;
  let questionCount = 0;
  const topics: ScoreTopic[] = [];

  for (const s of raterScores) {
    const meta = competencyMeta.get(s.competencyId);
    if (!meta) continue;
    rawScore += s.score;
    maxScore += meta.maxScore;
    weightedPercent += meta.maxScore > 0 ? (s.score / meta.maxScore) * meta.weight : 0;
    questionCount++;
    topics.push({ key: s.competencyId, label: meta.name, score: s.score, maxScore: meta.maxScore });
  }

  return finish(rawScore, maxScore, weightedPercent, questionCount, topics);
}

export interface ScoreThresholds {
  evalThresholdUrgentMax: number;
  evalThresholdWatchMax: number;
  evalThresholdGoodMin: number;
}

/** Ascending bands: URGENT <= urgentMax < WATCH <= watchMax < NEEDS_IMPROVEMENT < goodMin <= GOOD. */
export function bandScoreStatus(percent: number, t: ScoreThresholds): EvaluationScoreStatus {
  if (percent <= t.evalThresholdUrgentMax) return "URGENT";
  if (percent <= t.evalThresholdWatchMax) return "WATCH";
  if (percent < t.evalThresholdGoodMin) return "NEEDS_IMPROVEMENT";
  return "GOOD";
}
