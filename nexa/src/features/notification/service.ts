import { prisma } from "@/lib/prisma";
import { isLineConfigured, pushLineMessage } from "@/lib/integrations/line";

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
      await pushLineMessage(employee.lineUserId, `${input.title}\n${input.body}`);
    }
  }

  return record;
}
