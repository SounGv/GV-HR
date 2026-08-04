import { z } from "zod";

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(100).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
