import { prisma } from "@/lib/prisma";

export async function listNotifications(companyId: string, employeeId: string) {
  return prisma.notification.findMany({
    where: { companyId, employeeId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, category: true, read: true, createdAt: true },
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

/** Create an in-app notification for one employee (used by the AI send_notification tool). */
export async function createNotification(
  companyId: string,
  employeeId: string,
  input: { title: string; body: string; category?: string },
  createdById?: string | null,
) {
  return prisma.notification.create({
    data: {
      companyId,
      employeeId,
      title: input.title,
      body: input.body,
      category: input.category ?? "system",
      createdById: createdById ?? null,
    },
    select: { id: true },
  });
}
