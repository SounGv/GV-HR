import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { ScheduleTemplateCreateInput, ScheduleTemplateUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const listSelect = {
  id: true,
  name: true,
  active: true,
  intervalMonths: true,
  durationDays: true,
  raterTypes: true,
  nextRunAt: true,
  lastRunAt: true,
  department: { select: { id: true, name: true } },
  evaluationTemplate: { select: { id: true, name: true } },
  generatedCampaigns: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, name: true },
  },
} satisfies Prisma.EvaluationScheduleTemplateSelect;

const detailSelect = {
  ...listSelect,
  competencies: {
    select: { competencyId: true, weight: true, competency: { select: { name: true } } },
  },
} satisfies Prisma.EvaluationScheduleTemplateSelect;

function mapListItem(row: Prisma.EvaluationScheduleTemplateGetPayload<{ select: typeof listSelect }>) {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    department: row.department,
    intervalMonths: row.intervalMonths,
    durationDays: row.durationDays,
    raterTypes: row.raterTypes,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    lastGeneratedCampaign: row.generatedCampaigns[0] ?? null,
    evaluationTemplate: row.evaluationTemplate,
  };
}

export async function listScheduleTemplates(companyId: string) {
  const rows = await prisma.evaluationScheduleTemplate.findMany({
    where: { companyId, deletedAt: null },
    select: listSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapListItem);
}

export async function getScheduleTemplate(companyId: string, id: string) {
  const row = await prisma.evaluationScheduleTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: detailSelect,
  });
  if (!row) throw NotFound("ไม่พบรอบอัตโนมัติ");
  return {
    ...mapListItem(row),
    competencies: row.competencies.map((c) => ({
      competencyId: c.competencyId,
      name: c.competency.name,
      weight: c.weight,
    })),
  };
}

export async function createScheduleTemplate(
  companyId: string,
  session: AccessClaims,
  input: ScheduleTemplateCreateInput,
  meta?: Meta,
) {
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!department) throw BadRequest("ไม่พบแผนกที่เลือก");

  if (input.evaluationTemplateId) {
    const template = await prisma.evaluationTemplate.findFirst({
      where: { id: input.evaluationTemplateId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!template) throw BadRequest("ไม่พบแบบประเมินที่เลือก");
  } else {
    const competencyIds = (input.competencies ?? []).map((c) => c.competencyId);
    const found = await prisma.competency.count({
      where: { id: { in: competencyIds }, companyId, deletedAt: null },
    });
    if (found !== competencyIds.length) throw BadRequest("พบสมรรถนะที่ไม่ถูกต้อง");
  }

  const record = await prisma.evaluationScheduleTemplate.create({
    data: {
      companyId,
      name: input.name,
      departmentId: input.departmentId,
      intervalMonths: input.intervalMonths,
      durationDays: input.durationDays,
      raterTypes: input.raterTypes,
      nextRunAt: new Date(input.nextRunAt),
      active: input.active ?? true,
      createdById: session.sub,
      updatedById: session.sub,
      evaluationTemplateId: input.evaluationTemplateId,
      competencies: input.evaluationTemplateId
        ? undefined
        : { create: (input.competencies ?? []).map((c) => ({ competencyId: c.competencyId, weight: c.weight })) },
    },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_schedule.create",
    entity: "EvaluationScheduleTemplate",
    entityId: record.id,
    after: { name: input.name },
    ...meta,
  });

  return record;
}

export async function updateScheduleTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: ScheduleTemplateUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.evaluationScheduleTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw NotFound("ไม่พบรอบอัตโนมัติ");

  if (input.departmentId !== undefined) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!department) throw BadRequest("ไม่พบแผนกที่เลือก");
  }

  if (input.evaluationTemplateId !== undefined && input.evaluationTemplateId !== null) {
    const template = await prisma.evaluationTemplate.findFirst({
      where: { id: input.evaluationTemplateId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!template) throw BadRequest("ไม่พบแบบประเมินที่เลือก");
  }

  const changingCompetencies = input.competencies !== undefined;
  if (changingCompetencies) {
    const competencyIds = input.competencies!.map((c) => c.competencyId);
    const found = await prisma.competency.count({
      where: { id: { in: competencyIds }, companyId, deletedAt: null },
    });
    if (found !== competencyIds.length) throw BadRequest("พบสมรรถนะที่ไม่ถูกต้อง");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evaluationScheduleTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
        ...(input.intervalMonths !== undefined ? { intervalMonths: input.intervalMonths } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.raterTypes !== undefined ? { raterTypes: input.raterTypes } : {}),
        ...(input.nextRunAt !== undefined ? { nextRunAt: new Date(input.nextRunAt) } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        // Switching to a Template clears the Competency link and vice versa —
        // a schedule generates one kind of campaign at a time, never both.
        ...(input.evaluationTemplateId !== undefined
          ? { evaluationTemplateId: input.evaluationTemplateId }
          : {}),
        updatedById: session.sub,
      },
    });

    if (input.evaluationTemplateId) {
      await tx.evaluationScheduleCompetency.deleteMany({ where: { templateId: id } });
    } else if (changingCompetencies) {
      await tx.evaluationScheduleCompetency.deleteMany({ where: { templateId: id } });
      await tx.evaluationScheduleCompetency.createMany({
        data: input.competencies!.map((c) => ({ templateId: id, competencyId: c.competencyId, weight: c.weight })),
      });
    }
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_schedule.update",
    entity: "EvaluationScheduleTemplate",
    entityId: id,
    ...meta,
  });

  return { id };
}

export async function deleteScheduleTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const existing = await prisma.evaluationScheduleTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบรอบอัตโนมัติ");

  await prisma.evaluationScheduleTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), active: false, updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_schedule.delete",
    entity: "EvaluationScheduleTemplate",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });

  return { ok: true as const };
}
