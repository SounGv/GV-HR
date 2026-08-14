import { z } from "zod";

const optionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  score: z.coerce.number().min(0).max(100),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(1, "กรุณาระบุคำถาม").max(500),
    helpText: z.string().trim().max(500).optional(),
    answerType: z.enum(["NUMERIC", "LETTER", "CHOICE", "YES_NO", "LONG_TEXT"]),
    options: z.array(optionSchema).max(20).optional(),
    weight: z.coerce.number().int().min(1, "1-10").max(10, "1-10").default(1),
    required: z.boolean().default(true),
    order: z.coerce.number().int().min(0).default(0),
    visibleTo: z.array(z.enum(["SELF", "MANAGER", "PEER", "UPWARD", "HR_EXEC"])).default([]),
  })
  .refine((q) => q.answerType === "LONG_TEXT" || (q.options && q.options.length >= 2), {
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

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแบบประเมิน").max(200),
  description: z.string().trim().max(1000).optional(),
  sections: z.array(sectionSchema).min(1, "ต้องมีอย่างน้อย 1 หมวด"),
  aiGenerated: z.boolean().optional(),
  aiRationale: z.string().max(2000).optional(),
});
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;

export const templateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  sections: z.array(sectionSchema).min(1).optional(),
});
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
