import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { bangkokParts } from "@/lib/datetime";
import { NotFound } from "@/lib/api/errors";
import { refreshAttendanceWatch } from "@/features/attendance-status/watch-cache";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { HolidayCreateInput, HolidayUpdateInput } from "./schema";

const select = {
  id: true,
  date: true,
  name: true,
  type: true,
  notifyEnabled: true,
} as const;

export async function listHolidays(companyId: string, year?: number) {
  const y = year ?? bangkokParts().year;
  const from = new Date(Date.UTC(y, 0, 1));
  const to = new Date(Date.UTC(y + 1, 0, 1));

  return prisma.holiday.findMany({
    where: { companyId, deletedAt: null, date: { gte: from, lt: to } },
    select,
    orderBy: { date: "asc" },
  });
}

export async function getHoliday(companyId: string, id: string) {
  const holiday = await prisma.holiday.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!holiday) throw NotFound("ไม่พบวันหยุด");
  return holiday;
}

export async function createHoliday(
  companyId: string,
  input: HolidayCreateInput,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
) {
  // A deleted holiday still holds its (date, name) key in the database. Bring that row back
  // instead of failing with "already exists" for a holiday no screen shows.
  const deleted = await prisma.holiday.findFirst({
    where: { companyId, date: input.date, name: input.name, deletedAt: { not: null } },
    select: { id: true },
  });
  const created = deleted
    ? await prisma.holiday.update({
        where: { id: deleted.id },
        data: { ...input, deletedAt: null, updatedById: actor.sub },
        select,
      })
    : await prisma.holiday.create({
        data: { ...input, companyId, createdById: actor.sub, updatedById: actor.sub },
        select,
      });
  refreshAttendanceWatch(companyId);
  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "holiday.create",
    entity: "Holiday",
    entityId: created.id,
    after: { name: created.name, date: created.date },
    ...meta,
  });
  return created;
}

export async function updateHoliday(
  companyId: string,
  id: string,
  input: HolidayUpdateInput,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.holiday.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, date: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบวันหยุด");

  // Moving onto the date and name of a deleted holiday would hit its unique key: clear that deleted row first.
  if (input.date !== undefined || input.name !== undefined) {
    await prisma.holiday.deleteMany({
      where: {
        companyId,
        id: { not: id },
        date: input.date ?? existing.date,
        name: input.name ?? existing.name,
        deletedAt: { not: null },
      },
    });
  }

  const updated = await prisma.holiday.update({
    where: { id },
    data: { ...input, updatedById: actor.sub },
    select,
  });
  refreshAttendanceWatch(companyId);
  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "holiday.update",
    entity: "Holiday",
    entityId: id,
    after: input,
    ...meta,
  });
  return updated;
}

export async function deleteHoliday(
  companyId: string,
  id: string,
  actor: AccessClaims,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.holiday.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบวันหยุด");

  await prisma.holiday.update({ where: { id }, data: { deletedAt: new Date(), updatedById: actor.sub } });
  refreshAttendanceWatch(companyId);
  await writeAudit({
    companyId,
    actorUserId: actor.sub,
    action: "holiday.delete",
    entity: "Holiday",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}
