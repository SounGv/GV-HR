/**
 * Pure rules for a rater's answers (no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-round.mjs`).
 */

export type SnapAnswerType = "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH";
export type AnswerValue = number | string | string[];

export interface SnapQuestion {
  id: string;
  text: string;
  helpText: string | null;
  answerType: SnapAnswerType;
  options: { value: string; label: string }[] | null;
  weight: number;
  required: boolean;
  /** Rater types that see this question; empty means everyone. */
  visibleTo: string[];
}

export interface Answer {
  questionId: string;
  value: AnswerValue;
}

export const SHORT_MAX = 500;
export const PARAGRAPH_MAX = 4000;

/** The questions this kind of rater is asked. */
export const visibleQuestions = (questions: readonly SnapQuestion[], raterType: string): SnapQuestion[] =>
  questions.filter((q) => q.visibleTo.length === 0 || q.visibleTo.includes(raterType));

/** Returns a cleaned value when `value` is a valid answer to `q`, otherwise null (treated as unanswered). */
function cleanValue(q: SnapQuestion, value: unknown, ratingMax: number): AnswerValue | null {
  switch (q.answerType) {
    case "RATING": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isInteger(n) && n >= 1 && n <= ratingMax ? n : null;
    }
    case "CHOICE":
      return typeof value === "string" && (q.options ?? []).some((o) => o.value === value) ? value : null;
    case "MULTI_CHOICE": {
      if (!Array.isArray(value)) return null;
      const allowed = new Set((q.options ?? []).map((o) => o.value));
      const picked = [...new Set(value.filter((v): v is string => typeof v === "string" && allowed.has(v)))];
      return picked.length ? picked : null;
    }
    case "SHORT_TEXT":
      return typeof value === "string" && value.trim() ? value.trim().slice(0, SHORT_MAX) : null;
    case "PARAGRAPH":
      return typeof value === "string" && value.trim() ? value.trim().slice(0, PARAGRAPH_MAX) : null;
  }
}

/** Keeps only valid answers to questions this rater actually sees; anything else is dropped. Safe for saving a partial draft. */
export function cleanAnswers(
  questions: readonly SnapQuestion[],
  raterType: string,
  answers: readonly { questionId: string; value: unknown }[],
  ratingMax: number,
): Answer[] {
  const asked = new Map(visibleQuestions(questions, raterType).map((q) => [q.id, q]));
  const out = new Map<string, Answer>();
  for (const a of answers) {
    const q = asked.get(a.questionId);
    if (!q) continue;
    const value = cleanValue(q, a.value, ratingMax);
    if (value !== null) out.set(q.id, { questionId: q.id, value });
  }
  return [...out.values()];
}

/** What is still missing before this rater can submit (empty = ready). */
export function unansweredRequired(
  questions: readonly SnapQuestion[],
  raterType: string,
  answers: readonly Answer[],
): string[] {
  const done = new Set(answers.map((a) => a.questionId));
  return visibleQuestions(questions, raterType)
    .map((q, i) => ({ q, n: i + 1 }))
    .filter(({ q }) => q.required && !done.has(q.id))
    .map(({ n }) => `ข้อ ${n}`);
}

export interface QuestionSummary {
  questionId: string;
  text: string;
  answerType: SnapAnswerType;
  /** How many raters answered this question. */
  count: number;
  /** RATING only: plain average of the scores (not weighted, no grade). */
  average: number | null;
  /** CHOICE / MULTI_CHOICE: how many raters picked each option. */
  options: { label: string; count: number }[];
  /** SHORT_TEXT / PARAGRAPH: the written answers, without who wrote them. */
  texts: string[];
}

/**
 * Summarises one group of raters (e.g. all the peers) per question they were asked.
 * `sets` holds each rater's saved answers. Averages are plain means: weighting and
 * grading are left out until HR confirms how they should work.
 */
export function summarizeAnswers(
  questions: readonly SnapQuestion[],
  raterType: string,
  sets: readonly (readonly Answer[])[],
): QuestionSummary[] {
  return visibleQuestions(questions, raterType).map((q) => {
    const values = sets.flatMap((set) => set.filter((a) => a.questionId === q.id).map((a) => a.value));
    const numbers = values.filter((v): v is number => typeof v === "number");
    const picks = new Map<string, number>();
    for (const v of values) {
      for (const p of Array.isArray(v) ? v : typeof v === "string" ? [v] : []) picks.set(p, (picks.get(p) ?? 0) + 1);
    }
    const isChoice = q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE";
    return {
      questionId: q.id,
      text: q.text,
      answerType: q.answerType,
      count: values.length,
      average: q.answerType === "RATING" && numbers.length ? Math.round((numbers.reduce((s, n) => s + n, 0) / numbers.length) * 100) / 100 : null,
      options: isChoice ? (q.options ?? []).map((o) => ({ label: o.label, count: picks.get(o.value) ?? 0 })) : [],
      texts: q.answerType === "SHORT_TEXT" || q.answerType === "PARAGRAPH" ? values.filter((v): v is string => typeof v === "string") : [],
    };
  });
}
