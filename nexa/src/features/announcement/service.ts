import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  AnnouncementCreateInput,
  AnnouncementUpdateInput,
  AnnouncementListQuery,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

const select = {
  id: true,
  title: true,
  body: true,
  pinned: true,
  status: true,
  publishedAt: true,
  authorName: true,
  createdAt: true,
} satisfies Prisma.AnnouncementSelect;

async function authorName(companyId: string, session: AccessClaims): Promise<string | null> {
  if (!session.employeeId) return null;
  const emp = await prisma.employee.findFirst({
    where: { id: session.employeeId, companyId },
    select: { firstName: true, lastName: true },
  });
  return emp ? `${emp.firstName} ${emp.lastName}`.trim() : null;
}

export async function listAnnouncements(
  companyId: string,
  query: AnnouncementListQuery,
) {
  if (query.scope === "manage") {
    return prisma.announcement.findMany({
      where: { companyId, deletedAt: null },
      select,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  // feed → published only
  return prisma.announcement.findMany({
    where: { companyId, deletedAt: null, status: "PUBLISHED" },
    select,
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: 100,
  });
}

export async function getAnnouncement(companyId: string, id: string) {
  const announcement = await prisma.announcement.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!announcement) throw NotFound("ไม่พบประกาศ");
  return announcement;
}

export async function createAnnouncement(
  companyId: string,
  session: AccessClaims,
  input: AnnouncementCreateInput,
  meta?: Meta,
) {
  const record = await prisma.announcement.create({
    data: {
      companyId,
      authorEmployeeId: session.employeeId ?? null,
      authorUserId: session.sub,
      authorName: await authorName(companyId, session),
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      status: input.status,
      publishedAt: input.status === "PUBLISHED" ? new Date() : null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "announcement.create",
    entity: "Announcement",
    entityId: record.id,
    after: { title: input.title, status: input.status },
    ...meta,
  });

  return record;
}

export async function updateAnnouncement(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: AnnouncementUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!existing) throw NotFound("ไม่พบประกาศ");

  const willPublish = input.status === "PUBLISHED" && !existing.publishedAt;

  const record = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(willPublish ? { publishedAt: new Date() } : {}),
      updatedById: session.sub,
    },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "announcement.update",
    entity: "Announcement",
    entityId: id,
    ...meta,
  });

  return record;
}

export async function deleteAnnouncement(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบประกาศ");

  await prisma.announcement.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "announcement.delete",
    entity: "Announcement",
    entityId: id,
    ...meta,
  });
}
