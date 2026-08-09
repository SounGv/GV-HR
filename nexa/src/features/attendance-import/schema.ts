import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const attendanceImportRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  date: z.string().trim().regex(dateRe, "วันที่ต้องเป็น YYYY-MM-DD"),
  clockIn: z.string().trim().regex(timeRe, "เวลาเข้าต้องเป็น HH:MM"),
  clockOut: z.preprocess(emptyToNull, z.string().trim().regex(timeRe, "เวลาออกต้องเป็น HH:MM").nullable().optional()),
});
export type AttendanceImportRow = z.infer<typeof attendanceImportRowSchema>;

export const attendanceImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export const ATTENDANCE_IMPORT_COLUMNS = ["employeeCode", "date", "clockIn", "clockOut"] as const;
