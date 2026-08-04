import { z } from "zod";

export const competencyCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อสมรรถนะ").max(160),
  description: z.string().trim().max(1000).optional(),
  exampleBehavior: z.string().trim().max(500).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  order: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});
export type CompetencyCreateInput = z.infer<typeof competencyCreateSchema>;

export const competencyUpdateSchema = competencyCreateSchema.partial();
export type CompetencyUpdateInput = z.infer<typeof competencyUpdateSchema>;

export const competencyListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
});
export type CompetencyListQuery = z.infer<typeof competencyListQuerySchema>;
