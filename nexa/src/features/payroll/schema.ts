import { z } from "zod";

const periodRe = /^\d{4}-(0[1-9]|1[0-2])$/;

export const generatePayrollSchema = z.object({
  period: z.string().regex(periodRe, "รูปแบบงวดต้องเป็น YYYY-MM"),
});
export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;

export const payrollListQuerySchema = z.object({
  scope: z.enum(["me", "all"]).default("me"),
  period: z.string().regex(periodRe).optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});
export type PayrollListQuery = z.infer<typeof payrollListQuerySchema>;

export const sendPayslipEmailSchema = z.object({
  payrollRecordIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกอย่างน้อย 1 รายการ"),
});
export type SendPayslipEmailInput = z.infer<typeof sendPayslipEmailSchema>;

const lineItemSchema = z.object({
  label: z.string().trim().min(1, "กรุณาระบุรายการ").max(100),
  amount: z.coerce.number().min(0, "ต้องไม่ติดลบ"),
});

export const payrollAdjustSchema = z.object({
  extraEarnings: z.array(lineItemSchema).max(20).default([]),
  extraDeductions: z.array(lineItemSchema).max(20).default([]),
  note: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});
export type PayrollAdjustInput = z.infer<typeof payrollAdjustSchema>;
