import { z } from "zod";

export const REPORT_TYPES = [
  "employees",
  "attendance",
  "leave",
  "overtime",
  "payroll",
  "expense",
  "performance",
  "training",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  employees: "ทำเนียบพนักงาน",
  attendance: "สรุปการลงเวลา (รายเดือน)",
  leave: "สรุปการลา (รายปี)",
  overtime: "สรุป OT (รายเดือน)",
  payroll: "สรุปเงินเดือน (รายงวด)",
  expense: "สรุปเบิกจ่าย (รายเดือน)",
  performance: "สรุปผลประเมิน",
  training: "สรุปการอบรม",
};

/** Which reports take a month (YYYY-MM), a year (YYYY), or no period. */
export const REPORT_PERIOD_KIND: Record<ReportType, "month" | "year" | "none"> = {
  employees: "none",
  attendance: "month",
  leave: "year",
  overtime: "month",
  payroll: "month",
  expense: "month",
  performance: "none",
  training: "none",
};

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).default("employees"),
  from: dateStr.optional(),
  to: dateStr.optional(),
  departmentId: z.string().uuid().optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
