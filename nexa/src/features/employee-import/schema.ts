import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const importRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  firstName: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120),
  lastName: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(120)),
  nickname: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200).nullable().optional(),
  ),
  phone: z.preprocess(emptyToNull, z.string().trim().max(30).nullable().optional()),
  department: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  position: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  baseSalary: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().min(0, "เงินเดือนต้องไม่ติดลบ").nullable().optional(),
  ),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export const importPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export interface ImportSummary {
  created: number;
  updated: number;
  total: number;
  errors: { row: number; code: string; message: string }[];
  warnings: string[];
}

/** Normalized column key each import row is mapped to. */
export const IMPORT_COLUMNS = [
  "employeeCode",
  "firstName",
  "lastName",
  "nickname",
  "email",
  "phone",
  "department",
  "position",
  "baseSalary",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
