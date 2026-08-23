import { z } from "zod";

export const DEVELOPMENT_ITEM_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"] as const;

const optionalText = (max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().trim().max(max).optional());
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

export const developmentItemCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุหัวข้อ").max(200),
  description: optionalText(2000),
  method: optionalText(200),
  targetDate: optionalDate,
  // Improvement-plan fields (spec: สาเหตุ/วันเริ่ม/วันติดตาม) — optional so a
  // hand-authored IDP item (no "problem" to root-cause) is unaffected.
  problemDescription: optionalText(2000),
  startDate: optionalDate,
  followUpDate: optionalDate,
});
export type DevelopmentItemCreateInput = z.infer<typeof developmentItemCreateSchema>;

export const developmentItemUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(2000),
  method: optionalText(200),
  targetDate: optionalDate,
  status: z.enum(DEVELOPMENT_ITEM_STATUSES).optional(),
  problemDescription: optionalText(2000),
  startDate: optionalDate,
  followUpDate: optionalDate,
  managerNote: optionalText(2000),
  employeeNote: optionalText(2000),
});
export type DevelopmentItemUpdateInput = z.infer<typeof developmentItemUpdateSchema>;

export const progressNoteSchema = z.object({
  note: z.string().trim().min(1, "กรุณากรอกบันทึกความคืบหน้า").max(1000),
});
export type ProgressNoteInput = z.infer<typeof progressNoteSchema>;

export const planQuerySchema = z.object({
  cycle: z.string().trim().max(40).optional(),
});
export type PlanQuery = z.infer<typeof planQuerySchema>;
