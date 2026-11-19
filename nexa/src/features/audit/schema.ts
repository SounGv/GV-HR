import { z } from "zod";

/** A calendar day (YYYY-MM-DD) as the date box sends it; an empty box means no limit. */
const day = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z
    .string()
    .regex(/^d{4}-d{2}-d{2}$/, "วันที่ต้องอยู่ในรูปแบบ ปี-เดือน-วัน")
    .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, "วันที่ไม่ถูกต้อง")
    .optional(),
);

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(100).optional(),
  actorUserId: z.string().uuid().optional(),
  from: day,
  to: day,
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
