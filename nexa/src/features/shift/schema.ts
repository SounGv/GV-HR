import { z } from "zod";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const colorRe = /^#[0-9a-fA-F]{6}$/;

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อกะ").max(60),
  startTime: z.string().regex(timeRe, "เวลาไม่ถูกต้อง"),
  endTime: z.string().regex(timeRe, "เวลาไม่ถูกต้อง"),
  color: z.string().regex(colorRe, "สีไม่ถูกต้อง").default("#2563EB"),
  breakMinutes: z.coerce.number().int().min(0).max(480).default(0),
});
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;

export const templateUpdateSchema = templateCreateSchema.partial();
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;

export const assignmentUpsertSchema = z.object({
  employeeId: z.string().uuid(),
  templateId: z.string().uuid(),
  date: z.coerce.date({ message: "วันที่ไม่ถูกต้อง" }),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(200).optional(),
  ),
});
export type AssignmentUpsertInput = z.infer<typeof assignmentUpsertSchema>;

export const rangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
});

export const swapRequestCreateSchema = z.object({
  assignmentId: z.string().uuid(),
  targetEmployeeId: z.string().uuid(),
  reason: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
});
export type SwapRequestCreateInput = z.infer<typeof swapRequestCreateSchema>;

export const swapRequestListQuerySchema = z.object({
  scope: z.enum(["mine", "inbox"]).default("mine"),
});
export type SwapRequestListQuery = z.infer<typeof swapRequestListQuerySchema>;

export const swapRequestDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
});
export type SwapRequestDecideInput = z.infer<typeof swapRequestDecideSchema>;
