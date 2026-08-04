import { z } from "zod";

const raterTypesSchema = z
  .array(z.enum(["SELF", "MANAGER"]))
  .min(1, "ต้องเลือกทิศทางการประเมินอย่างน้อย 1 แบบ");

const competencyWeightSchema = z.object({
  competencyId: z.string().uuid(),
  weight: z.coerce.number().int().min(1, "1-5").max(5, "1-5"),
});

const INTERVAL_MONTHS = [1, 3, 6, 12] as const;

export const scheduleTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อรอบอัตโนมัติ").max(160),
  departmentId: z.string().uuid("กรุณาเลือกแผนก"),
  intervalMonths: z.coerce
    .number()
    .int()
    .refine((v) => (INTERVAL_MONTHS as readonly number[]).includes(v), "รอบไม่ถูกต้อง"),
  durationDays: z.coerce.number().int().min(1).max(90).default(14),
  raterTypes: raterTypesSchema.default(["SELF", "MANAGER"]),
  nextRunAt: z.string().min(1, "กรุณาเลือกวันที่เริ่มรอบแรก"),
  active: z.boolean().optional(),
  competencies: z.array(competencyWeightSchema).min(1, "ต้องมีอย่างน้อย 1 สมรรถนะ"),
});
export type ScheduleTemplateCreateInput = z.infer<typeof scheduleTemplateCreateSchema>;

export const scheduleTemplateUpdateSchema = scheduleTemplateCreateSchema.partial();
export type ScheduleTemplateUpdateInput = z.infer<typeof scheduleTemplateUpdateSchema>;
