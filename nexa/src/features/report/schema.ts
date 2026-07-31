import { z } from "zod";

export const REPORT_TYPES = [
  "employees",
  "attendance",
  "leave",
  "overtime",
  "payroll",
  "expense",
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
  training: "none",
};

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).default("employees"),
  period: z.string().max(7).optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
