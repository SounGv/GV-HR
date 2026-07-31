import { z } from "zod";

export const OT_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export const otCreateSchema = z
  .object({
    date: z.coerce.date({ message: "กรุณาเลือกวันที่" }),
    startTime: z.string().regex(timeRe, "เวลาไม่ถูกต้อง"),
    endTime: z.string().regex(timeRe, "เวลาไม่ถูกต้อง"),
    reason: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endTime"],
  });
export type OtCreateInput = z.infer<typeof otCreateSchema>;

export const otDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
});
export type OtDecideInput = z.infer<typeof otDecideSchema>;

export const otListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(OT_STATUSES).optional(),
});
export type OtListQuery = z.infer<typeof otListQuerySchema>;
