import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { NotFound } from "@/lib/api/errors";
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
  const y = year ?? new Date().getFullYear();
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
  const created = await prisma.holiday.create({
    data: { ...input, companyId, createdById: actor.sub, updatedById: actor.sub },
    select,
  });
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
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบวันหยุด");

  const updated = await prisma.holiday.update({
    where: { id },
    data: { ...input, updatedById: actor.sub },
    select,
  });
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
