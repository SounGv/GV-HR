import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/**
 * Dates in an HR spreadsheet come as YYYY-MM-DD, DD/MM/YYYY, or with a Buddhist
 * year (2569 → 2026). Blank means "not provided" (null). Anything else becomes
 * the string "invalid" so the date schema below reports a readable row error
 * instead of silently saving a wrong date.
 */
function parseImportDate(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (s === "") return null;
  let y: number;
  let m: number;
  let d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
  } else {
    return "invalid";
  }
  if (y > 2400) y -= 543;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  return date;
}

const importDate = z.preprocess(
  parseImportDate,
  z.date("วันที่ไม่ถูกต้อง (ใช้ YYYY-MM-DD หรือ DD/MM/YYYY)").nullable().optional(),
);

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
  branch: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  costCenter: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  /** Employee code of the direct manager (looked up after every row is saved, so a manager in the same file works). */
  managerCode: z.preprocess(emptyToNull, z.string().trim().max(20).nullable().optional()),
  hireDate: importDate,
  probationEndDate: importDate,
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
  "branch",
  "costCenter",
  "managerCode",
  "hireDate",
  "probationEndDate",
  "baseSalary",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
