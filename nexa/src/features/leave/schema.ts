import { z } from "zod";
import { dataUrlFileOrHttpUrlSchema } from "@/lib/image-schema";
import { HOURLY_LEAVE_TYPES, computeLeaveHours } from "./days";
import { HOURS_PER_LEAVE_DAY } from "./hour-pool";

export const LEAVE_TYPES = ["ANNUAL", "SICK", "PERSONAL", "UNPAID", "OTHER", "HOLIDAY_SWAP"] as const;
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const LEAVE_UNITS = ["DAY", "HOUR"] as const;
export const HALF_DAY_PERIODS = ["MORNING", "AFTERNOON"] as const;

const TIME_STRING = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "รูปแบบเวลาไม่ถูกต้อง (HH:mm)");

function sameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export const leaveCreateSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.coerce.date({ message: "กรุณาเลือกวันเริ่ม" }),
    endDate: z.coerce.date({ message: "กรุณาเลือกวันสิ้นสุด" }),
    halfDay: z.coerce.boolean().default(false),
    halfDayPeriod: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.enum(HALF_DAY_PERIODS).optional(),
    ),
    unit: z.enum(LEAVE_UNITS).default("DAY"),
    startTime: z.preprocess((v) => (v === "" || v == null ? undefined : v), TIME_STRING.optional()),
    endTime: z.preprocess((v) => (v === "" || v == null ? undefined : v), TIME_STRING.optional()),
    reason: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
    attachmentUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), dataUrlFileOrHttpUrlSchema()),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  })
  .refine((d) => !d.halfDay || sameDay(d.startDate, d.endDate), {
    message: "ลาครึ่งวันต้องเป็นวันเดียว",
    path: ["halfDay"],
  })
  .refine((d) => !d.halfDay || !!d.halfDayPeriod, {
    message: "กรุณาเลือกช่วงเวลาลาครึ่งวัน (เช้า/บ่าย)",
    path: ["halfDayPeriod"],
  })
  .refine((d) => d.unit !== "HOUR" || d.type === "UNPAID" || (HOURLY_LEAVE_TYPES as readonly string[]).includes(d.type), {
    message: "ลาเป็นชั่วโมงได้เฉพาะลาป่วย ลากิจ และลาไม่รับค่าจ้าง",
    path: ["unit"],
  })
  .refine((d) => d.unit !== "HOUR" || sameDay(d.startDate, d.endDate), {
    message: "ลาเป็นชั่วโมงต้องเป็นวันเดียว",
    path: ["endDate"],
  })
  .refine((d) => d.unit !== "HOUR" || !!(d.startTime && d.endTime), {
    message: "กรุณาระบุเวลาเริ่ม-สิ้นสุด",
    path: ["startTime"],
  })
  .refine((d) => d.unit !== "HOUR" || !d.startTime || !d.endTime || d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endTime"],
  })
  .refine(
    (d) => d.unit !== "HOUR" || !d.startTime || !d.endTime || d.endTime <= d.startTime || computeLeaveHours(d.startTime, d.endTime) >= 1,
    { message: "ลาเป็นชั่วโมงได้อย่างน้อย 1 ชั่วโมง", path: ["endTime"] },
  )
  .refine(
    (d) => d.unit !== "HOUR" || !d.startTime || !d.endTime || d.endTime <= d.startTime || computeLeaveHours(d.startTime, d.endTime) <= HOURS_PER_LEAVE_DAY,
    { message: `ลาเป็นชั่วโมงได้ไม่เกิน ${HOURS_PER_LEAVE_DAY} ชั่วโมง ถ้าลาทั้งวันให้เลือกเต็มวัน`, path: ["endTime"] },
  );
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;

export const decideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});
export type DecideInput = z.infer<typeof decideSchema>;

export const leaveListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(LEAVE_STATUSES).optional(),
});
export type LeaveListQuery = z.infer<typeof leaveListQuerySchema>;
