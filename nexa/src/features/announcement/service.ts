import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { isLineConfigured, pushLineMessage } from "@/lib/integrations/line";
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

/**
 * Tells every current employee about a newly published announcement — before
 * this, publishing was silent and people only saw it by opening the feed.
 * In-app rows go in with one createMany (the pooled connection serves one
 * query at a time, so per-employee inserts would be slow for a whole company);
 * LINE pushes are one network call per linked employee, so they run after the
 * response is sent instead of making the publisher wait.
 */
async function notifyPublished(
  companyId: string,
  announcement: { id: string; title: string; body: string },
  actorUserId: string,
) {
  const recipients = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true, lineUserId: true },
  });
  if (recipients.length === 0) return;

  const preview = announcement.body.length > 120 ? `${announcement.body.slice(0, 117)}…` : announcement.body;
  const link = `/announcements/${announcement.id}`;
  const title = `ประกาศ: ${announcement.title}`;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      companyId,
      employeeId: r.id,
      title,
      body: preview,
      category: "announcement",
      link,
      createdById: actorUserId,
    })),
  });

  if (!isLineConfigured()) return;
  const lineTargets = recipients.filter((r) => r.lineUserId).map((r) => r.lineUserId as string);
  if (lineTargets.length === 0) return;
  const text = `${title}\n${preview}\n${(process.env.APP_URL ?? "http://localhost:3000") + link}`;
  try {
    after(async () => {
      for (const to of lineTargets) {
        try {
          await pushLineMessage(to, text);
        } catch {
          // A failed LINE push never affects the in-app notification already saved.
        }
      }
    });
  } catch {
    // No request scope to defer into (e.g. called from a script) — in-app rows are already saved.
  }
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

  if (record.status === "PUBLISHED") await notifyPublished(companyId, record, session.sub);

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

  // Only the first publish notifies — later edits to a published announcement stay quiet.
  if (willPublish) await notifyPublished(companyId, record, session.sub);

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
