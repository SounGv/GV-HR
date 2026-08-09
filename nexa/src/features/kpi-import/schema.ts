import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const kpiImportRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  title: z.string().trim().min(1, "กรุณาระบุชื่อเป้าหมาย").max(200),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบ").max(40),
  unit: z.preprocess(emptyToNull, z.string().trim().max(20).nullable().optional()),
  targetValue: z.coerce.number().min(0, "เป้าหมายต้องไม่ติดลบ"),
  currentValue: z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0).default(0)),
  weight: z.preprocess((v) => (v === "" || v == null ? 1 : v), z.coerce.number().int().min(1).max(5).default(1)),
  dueDate: z.preprocess(
    emptyToNull,
    z.string().trim().regex(dateRe, "วันครบกำหนดต้องเป็น YYYY-MM-DD").nullable().optional(),
  ),
});
export type KpiImportRow = z.infer<typeof kpiImportRowSchema>;

export const kpiImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export const KPI_IMPORT_COLUMNS = ["employeeCode", "title", "cycle", "unit", "targetValue", "currentValue", "weight", "dueDate"] as const;
