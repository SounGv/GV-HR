import { z } from "zod";
import { dataUrlFileOrHttpUrlSchema } from "@/lib/image-schema";

export const LEAVE_TYPES = ["ANNUAL", "SICK", "PERSONAL", "UNPAID", "OTHER"] as const;
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

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
  });
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
