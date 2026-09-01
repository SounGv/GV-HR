import { prisma } from "@/lib/prisma";
import { isLineConfigured, pushLineMessage } from "@/lib/integrations/line";
import { writeAudit } from "@/lib/audit";
import { BadRequest } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { SendNotificationInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

export async function listNotifications(companyId: string, employeeId: string) {
  return prisma.notification.findMany({
    where: { companyId, employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, category: true, read: true, link: true, createdAt: true },
  });
}

export async function unreadCount(companyId: string, employeeId: string) {
  return prisma.notification.count({ where: { companyId, employeeId, read: false } });
}

export async function markAllRead(companyId: string, employeeId: string) {
  await prisma.notification.updateMany({
    where: { companyId, employeeId, read: false },
    data: { read: true },
  });
}

/**
 * Create an in-app notification for one employee (used by the AI
 * send_notification tool, and every leave/OT decision). Also best-effort
 * pushes the same message via LINE if the employee has linked their account —
 * failures there never affect the in-app notification, which is always the
 * source of truth.
 */
export async function createNotification(
  companyId: string,
  employeeId: string,
  input: { title: string; body: string; category?: string; link?: string },
  createdById?: string | null,
) {
  const record = await prisma.notification.create({
    data: {
      companyId,
      employeeId,
      title: input.title,
      body: input.body,
      category: input.category ?? "system",
      link: input.link ?? null,
      createdById: createdById ?? null,
    },
    select: { id: true },
  });

  if (isLineConfigured()) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { lineUserId: true },
    });
    if (employee?.lineUserId) {
      const linkLine = input.link ? `\n${(process.env.APP_URL ?? "http://localhost:3000") + input.link}` : "";
      await pushLineMessage(employee.lineUserId, `${input.title}\n${input.body}${linkLine}`);
    }
  }

  return record;
}

/**
 * HR-composed notification to a chosen set of employees — the "select
 * people, they see a bell notification" bulk-notify tool. One at a time
 * (not Promise.all): the pooled connection can only serve one query at a
 * time, and firing dozens concurrently exhausts the pool wait queue.
 */
export async function sendBulkNotification(
  companyId: string,
  session: AccessClaims,
  input: SendNotificationInput,
  meta?: Meta,
) {
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, id: { in: input.employeeIds } },
    select: { id: true },
  });
  if (employees.length === 0) throw BadRequest("ไม่พบพนักงานปลายทางที่เลือก");

  for (const emp of employees) {
    await createNotification(companyId, emp.id, { title: input.title, body: input.body, category: "hr" }, session.sub);
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "notification.broadcast",
    entity: "Notification",
    entityId: session.sub,
    after: { title: input.title, recipients: employees.length },
    ...meta,
  });

  return { sent: employees.length };
}
