/**
 * Pure rules for appraisal forms (no imports, so they can be checked with
 * `node --experimental-strip-types scripts/check-appraisal-form.mjs`).
 */

export type AnswerType = "RATING" | "CHOICE" | "MULTI_CHOICE" | "SHORT_TEXT" | "PARAGRAPH";
export type FormStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface QuestionDraft {
  text: string;
  answerType: AnswerType;
  options?: { value: string; label: string }[] | null;
  weight: number;
}

export const CHOICE_TYPES: ReadonlySet<AnswerType> = new Set(["CHOICE", "MULTI_CHOICE"]);

/** Only a DRAFT form can be edited; a published one needs a new version. */
export const isEditable = (status: FormStatus): boolean => status === "DRAFT";

/** Next version number for a lineage, given the versions that already exist. */
export const nextVersion = (existing: readonly number[]): number => (existing.length ? Math.max(...existing) + 1 : 1);

/** Everything that stops a form from being published, in words HR can act on (empty = ready). */
export function formProblems(questions: readonly QuestionDraft[]): string[] {
  if (questions.length === 0) return ["ยังไม่มีคำถาม"];
  const problems: string[] = [];
  questions.forEach((q, i) => {
    const n = i + 1;
    if (!q.text.trim()) problems.push(`ข้อ ${n} ยังไม่ได้พิมพ์คำถาม`);
    if (CHOICE_TYPES.has(q.answerType)) {
      const opts = q.options ?? [];
      if (opts.length < 2) problems.push(`ข้อ ${n} ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`);
      else if (opts.some((o) => !o.label.trim())) problems.push(`ข้อ ${n} มีตัวเลือกที่ยังว่าง`);
      else if (new Set(opts.map((o) => o.label.trim())).size !== opts.length) problems.push(`ข้อ ${n} มีตัวเลือกซ้ำกัน`);
    }
    if (q.answerType === "RATING" && !(q.weight >= 1)) problems.push(`ข้อ ${n} ต้องมีน้ำหนักอย่างน้อย 1`);
  });
  return problems;
}

/** Sum of weights of the questions that count towards the score (RATING only). */
export const ratingWeightTotal = (questions: readonly QuestionDraft[]): number =>
  questions.filter((q) => q.answerType === "RATING").reduce((sum, q) => sum + q.weight, 0);
