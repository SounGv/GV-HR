import { z } from "zod";

export const competencyCategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อหมวดหมู่").max(160),
  order: z.coerce.number().int().min(0).optional(),
});
export type CompetencyCategoryCreateInput = z.infer<typeof competencyCategoryCreateSchema>;

export const competencyCategoryUpdateSchema = competencyCategoryCreateSchema.partial();
export type CompetencyCategoryUpdateInput = z.infer<typeof competencyCategoryUpdateSchema>;
