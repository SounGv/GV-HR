import { z } from "zod";

export const ATTENDANCE_CORRECTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTime = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().regex(timeRe, "เวลาไม่ถูกต้อง").optional(),
);

export const attendanceCorrectionCreateSchema = z
  .object({
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
    requestedClockIn: optionalTime,
    requestedClockOut: optionalTime,
    reason: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(500),
  })
  .refine((d) => !!d.requestedClockIn || !!d.requestedClockOut, {
    message: "กรุณาระบุเวลาเข้าหรือออกที่ต้องการแก้ไขอย่างน้อยหนึ่งอย่าง",
    path: ["requestedClockIn"],
  });
export type AttendanceCorrectionCreateInput = z.infer<typeof attendanceCorrectionCreateSchema>;

export const attendanceCorrectionDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});
export type AttendanceCorrectionDecideInput = z.infer<typeof attendanceCorrectionDecideSchema>;

export const attendanceCorrectionListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(ATTENDANCE_CORRECTION_STATUSES).optional(),
});
export type AttendanceCorrectionListQuery = z.infer<typeof attendanceCorrectionListQuerySchema>;
