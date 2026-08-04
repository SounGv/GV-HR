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
