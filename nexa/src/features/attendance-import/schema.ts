import { z } from "zod";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

/** YYYY-MM-DD that is a real calendar date between 1900 and 2100 (2026-02-30 and a Buddhist-era 2569 are refused). */
const importDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ต้องเป็น YYYY-MM-DD")
  .superRefine((v, ctx) => {
    const [y, m, d] = v.split("-").map(Number);
    if (y > 2400) {
      ctx.addIssue({ code: "custom", message: "ปีต้องเป็น ค.ศ. (เช่น 2026) ไม่ใช่ พ.ศ." });
      return;
    }
    const dt = new Date(Date.UTC(y, m - 1, d));
    const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
    if (!real || y < 1900 || y > 2100) {
      ctx.addIssue({ code: "custom", message: "วันที่ไม่ถูกต้อง หรือปีอยู่นอกช่วง 1900 ถึง 2100" });
    }
  });

export const attendanceImportRowSchema = z.object({
  employeeCode: z.string().trim().min(1, "กรุณาระบุรหัสพนักงาน").max(20),
  date: importDate,
  clockIn: z.string().trim().regex(timeRe, "เวลาเข้าต้องเป็น HH:MM (00:00 ถึง 23:59)"),
  clockOut: z.preprocess(emptyToNull, z.string().trim().regex(timeRe, "เวลาออกต้องเป็น HH:MM (00:00 ถึง 23:59)").nullable().optional()),
});
export type AttendanceImportRow = z.infer<typeof attendanceImportRowSchema>;

export const attendanceImportPayloadSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "ไม่มีข้อมูล").max(2000, "เกิน 2000 แถว"),
});

export const ATTENDANCE_IMPORT_COLUMNS = ["employeeCode", "date", "clockIn", "clockOut"] as const;
