import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Conflict, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CompetencyCategoryCreateInput, CompetencyCategoryUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const select = {
  id: true,
  name: true,
  order: true,
  createdAt: true,
} as const;

export async function listCompetencyCategories(companyId: string) {
  return prisma.competencyCategory.findMany({
    where: { companyId, deletedAt: null },
    select,
    orderBy: { order: "asc" },
  });
}

export async function getCompetencyCategory(companyId: string, id: string) {
  const category = await prisma.competencyCategory.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!category) throw NotFound("ไม่พบหมวดหมู่");
  return category;
}

export async function createCompetencyCategory(
  companyId: string,
  session: AccessClaims,
  input: CompetencyCategoryCreateInput,
  meta?: Meta,
) {
  const dupe = await prisma.competencyCategory.findFirst({
    where: { companyId, name: input.name, deletedAt: null },
    select: { id: true },
  });
  if (dupe) throw Conflict("มีหมวดหมู่ชื่อนี้อยู่แล้ว");

  const record = await prisma.competencyCategory.create({
    data: {
      companyId,
      name: input.name,
      order: input.order ?? 0,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency_category.create",
    entity: "CompetencyCategory",
    entityId: record.id,
    after: { name: record.name },
    ...meta,
  });

  return record;
}

export async function updateCompetencyCategory(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: CompetencyCategoryUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.competencyCategory.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบหมวดหมู่");

  const record = await prisma.competencyCategory.update({
    where: { id },
    data: { ...input, updatedById: session.sub },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency_category.update",
    entity: "CompetencyCategory",
    entityId: id,
    after: input,
    ...meta,
  });

  return record;
}

export async function deleteCompetencyCategory(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.competencyCategory.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบหมวดหมู่");

  await prisma.$transaction([
    prisma.competencyCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: session.sub },
    }),
    // Competencies keep their categoryId pointing at a soft-deleted category is
    // avoided — unlink them so they fall back to the "uncategorized" bucket.
    prisma.competency.updateMany({
      where: { companyId, categoryId: id },
      data: { categoryId: null },
    }),
  ]);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency_category.delete",
    entity: "CompetencyCategory",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}
