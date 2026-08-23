import { z } from "zod";

const optionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  score: z.coerce.number().min(0).max(100),
});

const ANSWER_TYPES = ["NUMERIC", "LETTER", "CHOICE", "YES_NO", "LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"] as const;
const NON_SCORING_ANSWER_TYPES = new Set(["LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"]);

const questionSchema = z
  .object({
    text: z.string().trim().min(1, "กรุณาระบุคำถาม").max(500),
    helpText: z.string().trim().max(500).optional(),
    answerType: z.enum(ANSWER_TYPES),
    options: z.array(optionSchema).max(20).optional(),
    // Weight is now a percentage-point share of the whole template (see the
    // template-level sum-to-100 refine below), not a small 1-10 relative
    // importance number — HR sees this as "% of total score" in the UI.
    weight: z.coerce.number().int().min(1, "1-100").max(100, "1-100").default(1),
    required: z.boolean().default(true),
    order: z.coerce.number().int().min(0).default(0),
    visibleTo: z.array(z.enum(["SELF", "MANAGER", "PEER", "UPWARD", "HR_EXEC"])).default([]),
    // Set when this question was pulled from the reusable Question Bank
    // (Competency) — text/weight/options above are still copied per-template
    // so they can be tweaked without mutating the shared bank entry.
    competencyId: z.string().uuid().optional(),
  })
  .refine((q) => NON_SCORING_ANSWER_TYPES.has(q.answerType) || (q.options && q.options.length >= 2), {
    message: "ต้องมีตัวเลือกอย่างน้อย 2 รายการ",
    path: ["options"],
  })
  .refine((q) => !q.options || new Set(q.options.map((o) => o.value)).size === q.options.length, {
    // Scoring resolves an answer by matching its value against this list
    // (see scoreTemplateAnswers) — a duplicate value would make that match
    // ambiguous and silently score against whichever duplicate comes first.
    message: "ตัวเลือกต้องไม่ซ้ำกัน",
    path: ["options"],
  });

const sectionSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อหมวด").max(200),
  order: z.coerce.number().int().min(0).default(0),
  questions: z.array(questionSchema).min(1, "ต้องมีอย่างน้อย 1 ข้อย่อยต่อหมวด"),
});

/** Every scoring question's weight (across every section) must sum to
 * exactly 100 — non-scoring types (LONG_TEXT/SHORT_TEXT/FILE_EVIDENCE) are
 * excluded since they never contribute to the score. */
function weightSumsTo100(sections: { questions: { answerType: string; weight: number }[] }[]): boolean {
  const total = sections
    .flatMap((s) => s.questions)
    .filter((q) => !NON_SCORING_ANSWER_TYPES.has(q.answerType))
    .reduce((sum, q) => sum + q.weight, 0);
  return total === 100;
}

/** Flags an exact-duplicate question (same text + answerType) so HR notices
 * before publishing rather than after employees start answering it twice. */
function hasNoDuplicateQuestions(sections: { questions: { text: string; answerType: string }[] }[]): boolean {
  const seen = new Set<string>();
  for (const q of sections.flatMap((s) => s.questions)) {
    const key = `${q.text.trim().toLowerCase()}|${q.answerType}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

const WEIGHT_MESSAGE = { message: "น้ำหนักคะแนนรวมของทุกข้อ (ไม่นับข้อความอิสระ/แนบไฟล์) ต้องเท่ากับ 100%", path: ["sections"] as string[] };
const DUPLICATE_MESSAGE = { message: "มีคำถามซ้ำกันในแบบประเมินนี้", path: ["sections"] as string[] };

export const templateCreateSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณาระบุชื่อแบบประเมิน").max(200),
    description: z.string().trim().max(1000).optional(),
    evaluationType: z.string().trim().max(60).optional(),
    departmentId: z.string().uuid().optional(),
    positionId: z.string().uuid().optional(),
    sections: z.array(sectionSchema).min(1, "ต้องมีอย่างน้อย 1 หมวด"),
    aiGenerated: z.boolean().optional(),
    aiRationale: z.string().max(2000).optional(),
  })
  .refine((v) => weightSumsTo100(v.sections), WEIGHT_MESSAGE)
  .refine((v) => hasNoDuplicateQuestions(v.sections), DUPLICATE_MESSAGE);
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;

// The weight/duplicate check only makes sense when `sections` is actually
// part of this particular update — a status-only PATCH has none.
export const templateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
    evaluationType: z.string().trim().max(60).optional(),
    departmentId: z.string().uuid().optional(),
    positionId: z.string().uuid().optional(),
    sections: z.array(sectionSchema).min(1).optional(),
  })
  .refine((v) => !v.sections || weightSumsTo100(v.sections), WEIGHT_MESSAGE)
  .refine((v) => !v.sections || hasNoDuplicateQuestions(v.sections), DUPLICATE_MESSAGE);
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

export const templateListQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});
export type TemplateListQuery = z.infer<typeof templateListQuerySchema>;

export const aiTemplateDesignerRequestSchema = z.object({
  mode: z.enum(["generate", "critique"]).default("generate"),
  scope: z.enum(["department", "company"]),
  targetId: z.string().uuid().optional(),
  instruction: z.string().max(2000).optional(),
  // Only used when mode === "critique" — the HR-edited draft to review.
  draft: z
    .object({
      name: z.string(),
      description: z.string().optional(),
      sections: z.array(sectionSchema),
    })
    .optional(),
});
export type AiTemplateDesignerRequestInput = z.infer<typeof aiTemplateDesignerRequestSchema>;
