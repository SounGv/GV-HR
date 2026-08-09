import { z } from "zod";

const periodRe = /^\d{4}-(0[1-9]|1[0-2])$/;

export const payrollImportRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  period: z.string().trim().regex(periodRe, "งวดต้องเป็นรูปแบบ YYYY-MM"),
  label: z.string().trim().min(1, "กรุณาระบุรายการ").max(100),
  type: z.enum(["earning", "deduction"], { message: "ประเภทต้องเป็น earning หรือ deduction" }),
  amount: z.coerce.number().min(0, "จำนวนเงินต้องไม่ติดลบ"),
});
export type PayrollImportRow = z.infer<typeof payrollImportRowSchema>;

export const payrollImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export const PAYROLL_IMPORT_COLUMNS = ["employeeCode", "period", "label", "type", "amount"] as const;
export type PayrollImportColumn = (typeof PAYROLL_IMPORT_COLUMNS)[number];
