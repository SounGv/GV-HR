import { z } from "zod";
import { parseHM, MIN_OT_MINUTES } from "./calc";

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
  // Same MIN_OT_MINUTES floor the auto-reconciliation path already enforces
  // (calc.ts) — without it, a manager could approve e.g. a 5-minute request
  // that then pays ฿0 once estimateAmount rounds it to the nearest half hour,
  // which reads as a bug ("approved but paid nothing") rather than a policy.
  .superRefine((d, ctx) => {
    const diffMinutes = parseHM(d.endTime) - parseHM(d.startTime);
    if (diffMinutes <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม", path: ["endTime"] });
      return;
    }
    if (diffMinutes < MIN_OT_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ขอ OT ได้อย่างน้อย ${MIN_OT_MINUTES} นาที`,
        path: ["endTime"],
      });
    }
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

/** Requester, their manager, or HR editing the stated reason — no status restriction, see updateOvertimeReason. */
export const otUpdateReasonSchema = z.object({
  reason: z.string().trim().max(500),
});
export type OtUpdateReasonInput = z.infer<typeof otUpdateReasonSchema>;

/** Manager/HR adding or correcting their decision note after the fact — the decide flow itself never captured one in the UI. */
export const otUpdateNoteSchema = z.object({
  note: z.string().trim().max(500),
});
export type OtUpdateNoteInput = z.infer<typeof otUpdateNoteSchema>;

export const otListQuerySchema = z.object({
  scope: z.enum(["me", "team", "all"]).default("me"),
  status: z.enum(OT_STATUSES).optional(),
});
export type OtListQuery = z.infer<typeof otListQuerySchema>;
