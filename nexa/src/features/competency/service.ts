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
  exampleBehavior: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  order: true,
  active: true,
  questionType: true,
  maxScore: true,
  defaultWeight: true,
  departmentId: true,
  positionId: true,
  evaluationType: true,
  isRequired: true,
  createdAt: true,
  _count: { select: { bankQuestions: true } },
} as const;

function withUsageCount<T extends { _count: { bankQuestions: number } }>({ _count, ...rest }: T) {
  return { ...rest, usageCount: _count.bankQuestions };
}

/** Question Bank — this is the same reusable, company-scoped Competency row
 * every campaign already links via EvaluationCampaignCompetency; the extra
 * fields here (questionType/maxScore/defaultWeight/department/position/
 * evaluationType/isRequired) let a Template question pull a ready-made
 * question from here instead of HR authoring it from scratch every cycle. */
export async function listCompetencies(companyId: string, query: CompetencyListQuery) {
  const rows = await prisma.competency.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.positionId ? { positionId: query.positionId } : {}),
      ...(query.evaluationType ? { evaluationType: query.evaluationType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { description: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select,
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }, { name: "asc" }],
  });
  return rows.map(withUsageCount);
}

export async function getCompetency(companyId: string, id: string) {
  const competency = await prisma.competency.findFirst({
    where: { id, companyId, deletedAt: null },
    select,
  });
  if (!competency) throw NotFound("ไม่พบหัวข้อประเมิน");
  return withUsageCount(competency);
}

/** Every EvaluationCampaign/EvaluationTemplate this bank item is used in —
 * "ดูว่าหัวข้อนี้ถูกใช้ในรอบใดบ้าง". */
export async function getCompetencyUsage(companyId: string, id: string) {
  const existing = await prisma.competency.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!existing) throw NotFound("ไม่พบหัวข้อประเมิน");

  const [campaigns, templateQuestions] = await Promise.all([
    prisma.evaluationCampaignCompetency.findMany({
      where: { competencyId: id, campaign: { companyId, deletedAt: null } },
      select: { campaign: { select: { id: true, name: true, cycle: true, status: true } } },
    }),
    prisma.evaluationTemplateQuestion.findMany({
      where: { competencyId: id, section: { template: { companyId, deletedAt: null } } },
      select: {
        section: { select: { template: { select: { id: true, name: true, status: true, version: true } } } },
      },
    }),
  ]);

  return {
    campaigns: campaigns.map((c) => c.campaign),
    templates: templateQuestions.map((q) => q.section.template),
  };
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
  if (dupe) throw Conflict("มีหัวข้อประเมินชื่อนี้อยู่แล้ว");

  const record = await prisma.competency.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      exampleBehavior: input.exampleBehavior,
      categoryId: input.categoryId ?? null,
      order: input.order ?? 0,
      active: input.active ?? true,
      questionType: input.questionType ?? "RATING_1_TO_5",
      maxScore: input.maxScore ?? 5,
      defaultWeight: input.defaultWeight ?? 1,
      departmentId: input.departmentId ?? null,
      positionId: input.positionId ?? null,
      evaluationType: input.evaluationType ?? null,
      isRequired: input.isRequired ?? true,
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

  return withUsageCount(record);
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
  if (!existing) throw NotFound("ไม่พบหัวข้อประเมิน");

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

  return withUsageCount(record);
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
  if (!existing) throw NotFound("ไม่พบหัวข้อประเมิน");

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

/** "คัดลอกหัวข้อ" — a same-shape independent copy, so editing one never
 * touches the other (no shared row, unlike a template's bank *link*). */
export async function duplicateCompetency(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const source = await prisma.competency.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      name: true,
      description: true,
      exampleBehavior: true,
      categoryId: true,
      order: true,
      questionType: true,
      maxScore: true,
      defaultWeight: true,
      departmentId: true,
      positionId: true,
      evaluationType: true,
      isRequired: true,
    },
  });
  if (!source) throw NotFound("ไม่พบหัวข้อประเมิน");

  let name = `${source.name} (คัดลอก)`;
  for (let n = 2; await prisma.competency.findFirst({ where: { companyId, name, deletedAt: null }, select: { id: true } }); n++) {
    name = `${source.name} (คัดลอก ${n})`;
  }

  const record = await prisma.competency.create({
    data: { ...source, companyId, name, active: true, createdById: session.sub, updatedById: session.sub },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "competency.duplicate",
    entity: "Competency",
    entityId: record.id,
    before: { sourceId: id },
    after: { name: record.name },
    ...meta,
  });

  return withUsageCount(record);
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
  if (existing) return withUsageCount(existing);

  const record = await prisma.competency.create({
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
  return withUsageCount(record);
}
