import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(1000).optional(),
);

export const competencySchema = z.object({
  name: z.string().trim().min(1),
  score: z.coerce.number().min(1, "ต่ำสุด 1").max(5, "สูงสุด 5"),
});

export const reviewCreateSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบการประเมิน").max(40),
  competencies: z.array(competencySchema).min(1, "ต้องมีอย่างน้อย 1 หัวข้อ"),
  strengths: optionalText,
  improvements: optionalText,
  summary: optionalText,
});
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export const reviewUpdateSchema = z.object({
  cycle: z.string().trim().min(1).max(40).optional(),
  competencies: z.array(competencySchema).min(1).optional(),
  strengths: optionalText,
  improvements: optionalText,
  summary: optionalText,
});
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;

export const reviewListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
