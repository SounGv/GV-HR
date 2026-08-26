import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { EMPLOYMENT_TYPES } from "@/features/employee/schema";

export const REPORT_TYPES = [
  "employees",
  "attendance",
  "attendance_daily",
  "leave",
  "overtime",
  "payroll",
  "expense",
  "performance",
  "kpi",
  "okr",
  "training",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  employees: "ทำเนียบพนักงาน",
  attendance: "สรุปการลงเวลา (รายเดือน)",
  attendance_daily: "รายละเอียดการลงเวลา (รายวัน)",
  leave: "สรุปการลา (รายปี)",
  overtime: "สรุป OT (รายเดือน)",
  payroll: "สรุปเงินเดือน (รายงวด)",
  expense: "สรุปเบิกจ่าย (รายเดือน)",
  performance: "สรุปผลประเมิน",
  kpi: "สรุป KPI",
  okr: "สรุป OKR",
  training: "สรุปการอบรม",
};

/** Which reports take a month (YYYY-MM), a year (YYYY), or no period. */
export const REPORT_PERIOD_KIND: Record<ReportType, "month" | "year" | "none"> = {
  employees: "none",
  attendance: "month",
  attendance_daily: "month",
  leave: "year",
  overtime: "month",
  payroll: "month",
  expense: "month",
  performance: "none",
  kpi: "none",
  okr: "none",
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
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
});
/**
 * `employeeWhere` is intentionally NOT part of `reportQuerySchema` (never
 * accepted from a user request body) — it's set only by the AI Assistant's
 * scoped tool caller (`src/lib/ai/scope.ts`) to narrow a report down to a
 * manager's granted team/department, in-process before `getReport` runs.
 */
export type ReportQuery = z.infer<typeof reportQuerySchema> & {
  employeeWhere?: Prisma.EmployeeWhereInput;
};
