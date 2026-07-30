import { prisma } from "@/lib/prisma";

/**
 * Append an immutable audit-log entry. Fire-and-forget friendly, but await it
 * inside a transaction when the audit must be atomic with the change.
 */
export async function writeAudit(entry: {
  companyId: string;
  actorUserId?: string | null;
  action: string; // e.g. "employee.create"
  entity: string; // e.g. "Employee"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: entry.companyId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? undefined) as never,
      after: (entry.after ?? undefined) as never,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
