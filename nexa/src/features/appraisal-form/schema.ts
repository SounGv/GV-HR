import { z } from "zod";

export const ANSWER_TYPES = ["RATING", "CHOICE", "MULTI_CHOICE", "SHORT_TEXT", "PARAGRAPH"] as const;
export const RATER_TYPES = ["SELF", "MANAGER", "PEER", "SUBORDINATE"] as const;

const optionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().max(120),
});

/** Drafts may be saved half-finished (empty text, too few options); `formProblems` blocks publishing instead. */
export const questionSchema = z.object({
  text: z.string().trim().max(500),
  helpText: z.string().trim().max(500).optional().nullable(),
  answerType: z.enum(ANSWER_TYPES),
  options: z.array(optionSchema).max(20).optional().nullable(),
  weight: z.coerce.number().int().min(0).max(100).default(1),
  required: z.boolean().default(true),
  visibleTo: z.array(z.enum(RATER_TYPES)).default([]),
});

export const formCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแบบประเมิน").max(200),
  description: z.string().trim().max(1000).optional(),
});

export const formUpdateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแบบประเมิน").max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  questions: z.array(questionSchema).max(100).optional(),
});

export type FormCreateInput = z.infer<typeof formCreateSchema>;
export type FormUpdateInput = z.infer<typeof formUpdateSchema>;
