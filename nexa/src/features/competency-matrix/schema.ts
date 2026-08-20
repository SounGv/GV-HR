import { z } from "zod";

const levelItem = z.object({
  competencyId: z.string().uuid(),
  level: z.coerce.number().int().min(0).max(5), // 0 = "not required" / clears the row
});

export const setPositionRequirementsSchema = z.object({
  items: z.array(levelItem).max(200),
});
export type SetPositionRequirementsInput = z.infer<typeof setPositionRequirementsSchema>;

const employeeLevelItem = z.object({
  competencyId: z.string().uuid(),
  level: z.coerce.number().int().min(0).max(5), // 0 = clears the assessment
  note: z.string().trim().max(500).optional(),
});

export const setEmployeeLevelsSchema = z.object({
  items: z.array(employeeLevelItem).max(200),
});
export type SetEmployeeLevelsInput = z.infer<typeof setEmployeeLevelsSchema>;
