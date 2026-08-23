import { z } from "zod";

const QUESTION_TYPES = [
  "RATING_1_TO_5",
  "PERCENTAGE",
  "NUMERIC_TARGET",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "YES_NO",
  "SHORT_TEXT",
  "LONG_TEXT",
  "FILE_EVIDENCE",
] as const;

export const competencyCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อหัวข้อ").max(160),
  description: z.string().trim().max(1000).optional(),
  exampleBehavior: z.string().trim().max(500).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  order: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
  // Question-bank fields
  questionType: z.enum(QUESTION_TYPES).optional(),
  maxScore: z.coerce.number().min(1).max(1000).optional(),
  defaultWeight: z.coerce.number().int().min(1).max(100).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  positionId: z.string().uuid().optional().nullable(),
  evaluationType: z.string().trim().max(60).optional().nullable(),
  isRequired: z.boolean().optional(),
});
export type CompetencyCreateInput = z.infer<typeof competencyCreateSchema>;

export const competencyUpdateSchema = competencyCreateSchema.partial();
export type CompetencyUpdateInput = z.infer<typeof competencyUpdateSchema>;

export const competencyListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
  search: z.string().trim().max(160).optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  evaluationType: z.string().trim().max(60).optional(),
});
export type CompetencyListQuery = z.infer<typeof competencyListQuerySchema>;
