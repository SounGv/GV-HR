import { z } from "zod";

const codeRe = /^[A-Za-z0-9-]+$/;

const nullableId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().uuid().nullable(),
);

export const departmentCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120),
  code: z.string().trim().min(1, "กรุณาระบุรหัส").max(30).regex(codeRe, "ใช้ตัวอักษร ตัวเลข หรือ - เท่านั้น"),
  parentId: nullableId.optional(),
});
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).regex(codeRe).optional(),
  parentId: nullableId.optional(),
});
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

/** Named job levels (higher number = more senior). Stored in Position.level (Int). */
export const JOB_LEVELS = [
  { value: 3, label: "CEO / ผู้บริหาร" },
  { value: 2, label: "ผู้จัดการ" },
  { value: 1, label: "ปฏิบัติการ" },
] as const;

export const positionCreateSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อตำแหน่ง").max(120),
  code: z.string().trim().min(1, "กรุณาระบุรหัส").max(30).regex(codeRe, "ใช้ตัวอักษร ตัวเลข หรือ - เท่านั้น"),
  level: z.coerce.number().int().min(1).max(9).default(1),
  departmentId: nullableId.optional(),
});
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;

export const positionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).regex(codeRe).optional(),
  level: z.coerce.number().int().min(1).max(9).optional(),
  departmentId: nullableId.optional(),
});
export type PositionUpdateInput = z.infer<typeof positionUpdateSchema>;
