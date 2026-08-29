import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/format";
import type { AuditLogQuery } from "./schema";

export async function listAuditLogs(companyId: string, query: AuditLogQuery) {
  const where = {
    companyId,
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: { contains: query.action, mode: "insensitive" as const } } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  // Sequential, not Promise.all — connection_limit=1 (concurrent Prisma
  // calls can throw P2024 instead of all completing).
  const rows = await prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        actor: {
          select: {
            email: true,
            username: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  const total = await prisma.auditLog.count({ where });

  const items = rows.map((r) => ({
    ...r,
    actor: r.actor
      ? {
          email: r.actor.email,
          username: r.actor.username,
          name: r.actor.employee ? fullName(r.actor.employee.firstName, r.actor.employee.lastName) : null,
        }
      : null,
  }));

  return { items, total };
}

/** Distinct entity names seen for this company — powers the filter dropdown. */
export async function listAuditEntities(companyId: string): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: { companyId },
    select: { entity: true },
    distinct: ["entity"],
    orderBy: { entity: "asc" },
    take: 100,
  });
  return rows.map((r) => r.entity);
}
