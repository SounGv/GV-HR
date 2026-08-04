import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Conflict, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CompetencyCreateInput, CompetencyListQuery, CompetencyUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const select = {
  id: true,
  name: true,
  description: true,
  active: true,
  createdAt: true,
} as const;

export async function listCompetencies(companyId: string, query: CompetencyListQuery) {
  return prisma.competency.findMany({
    where: { companyId, deletedAt: null, ...(query.includeInactive ? {} : { active: true }) },
    select,
    orderBy: { name: "asc" },
  });
}

export async function getCompetency(companyId: string, id: string) {
  const competency = await prisma.competency.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!competency) throw NotFound("ไม่พบสมรรถนะ");
  return competency;
}

export async function createCompetency(
  companyId: string,
  session: AccessClaims,
  input: CompetencyCreateInput,
  meta?: Meta,
) {
  const dupe = await prisma.competency.findFirst({
    where: { companyId, name: input.name, deletedAt: null },
    select: { id: true },
  });
  if (dupe) throw Conflict("มีสมรรถนะชื่อนี้อยู่แล้ว");

  const record = await prisma.competency.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      active: input.active ?? true,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency.create",
    entity: "Competency",
    entityId: record.id,
    after: { name: record.name },
    ...meta,
  });

  return record;
}

export async function updateCompetency(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: CompetencyUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.competency.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบสมรรถนะ");

  const record = await prisma.competency.update({
    where: { id },
    data: { ...input, updatedById: session.sub },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency.update",
    entity: "Competency",
    entityId: id,
    after: input,
    ...meta,
  });

  return record;
}

export async function deleteCompetency(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.competency.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบสมรรถนะ");

  await prisma.competency.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency.delete",
    entity: "Competency",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}

/** Upsert-by-name helper used by the AI Performance Designer wiring (campaign creation). */
export async function upsertCompetencyByName(
  companyId: string,
  session: AccessClaims,
  name: string,
  description?: string,
) {
  const existing = await prisma.competency.findFirst({
    where: { companyId, name, deletedAt: null },
    select,
  });
  if (existing) return existing;

  return prisma.competency.create({
    data: {
      companyId,
      name,
      description,
      active: true,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select,
  });
}
