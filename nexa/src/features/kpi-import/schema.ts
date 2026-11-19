import { z } from "zod";
import { MAX_DATE_YEAR, MIN_DATE_YEAR } from "@/lib/date-schema";

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
  // Checked per row here, before anything is written: a month-13 or BE-year date fails this row only.
  dueDate: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .regex(dateRe, "วันครบกำหนดต้องเป็น YYYY-MM-DD")
      // 2026-02-30 would silently roll over to 2 March; require the day to exist.
      .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "วันครบกำหนดไม่ใช่วันที่จริง")
      .refine((v) => Number(v.slice(0, 4)) >= MIN_DATE_YEAR && Number(v.slice(0, 4)) <= MAX_DATE_YEAR, "ปีต้องเป็น ค.ศ. เช่น 2026 ไม่ใช่ พ.ศ.")
      .nullable()
      .optional(),
  ),
});
export type KpiImportRow = z.infer<typeof kpiImportRowSchema>;

export const kpiImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export const KPI_IMPORT_COLUMNS = ["employeeCode", "title", "cycle", "unit", "targetValue", "currentValue", "weight", "dueDate"] as const;
