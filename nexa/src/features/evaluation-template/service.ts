import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { TemplateCreateInput, TemplateListQuery, TemplateUpdateInput } from "./schema";
import type { CampaignTemplateSnapshot } from "./types";

type Meta = { ip?: string; userAgent?: string };

const sectionSelect = {
  id: true,
  name: true,
  order: true,
  questions: {
    select: {
      id: true,
      text: true,
      helpText: true,
      answerType: true,
      options: true,
      weight: true,
      required: true,
      order: true,
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.EvaluationTemplateSectionSelect;

export async function listTemplates(companyId: string, query: TemplateListQuery) {
  const templates = await prisma.evaluationTemplate.findMany({
    where: { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      aiGenerated: true,
      updatedAt: true,
      sections: { select: { _count: { select: { questions: true } } } },
      _count: { select: { sections: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    aiGenerated: t.aiGenerated,
    updatedAt: t.updatedAt,
    sectionCount: t._count.sections,
    questionCount: t.sections.reduce((sum, s) => sum + s._count.questions, 0),
  }));
}

export async function getTemplate(companyId: string, id: string) {
  const template = await prisma.evaluationTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      aiGenerated: true,
      aiRationale: true,
      updatedAt: true,
      sections: { select: sectionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!template) throw NotFound("ไม่พบแบบประเมิน");

  return {
    ...template,
    sections: template.sections as unknown as CampaignTemplateSnapshot["sections"],
    sectionCount: template.sections.length,
    questionCount: template.sections.reduce((sum, s) => sum + s.questions.length, 0),
  };
}

export async function createTemplate(
  companyId: string,
  session: AccessClaims,
  input: TemplateCreateInput,
  meta?: Meta,
) {
  const template = await prisma.evaluationTemplate.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      aiGenerated: input.aiGenerated ?? false,
      aiRationale: input.aiRationale,
      createdById: session.sub,
      updatedById: session.sub,
      sections: {
        create: input.sections.map((s, si) => ({
          name: s.name,
          order: s.order ?? si,
          questions: {
            create: s.questions.map((q, qi) => ({
              text: q.text,
              helpText: q.helpText,
              answerType: q.answerType,
              options: q.options as Prisma.InputJsonValue[] | undefined,
              weight: q.weight,
              required: q.required,
              order: q.order ?? qi,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_template.create",
    entity: "EvaluationTemplate",
    entityId: template.id,
    after: { name: input.name },
    ...meta,
  });

  return { id: template.id };
}

/**
 * Structural edits (sections/questions) are only allowed while the template
 * is still DRAFT — once ACTIVE, campaigns may already be picking it, and
 * every campaign freezes its own `templateSnapshot` at create time anyway,
 * so this is a UX guard against HR confusing themselves mid-cycle, not a
 * data-integrity requirement. name/description/status remain editable always.
 */
export async function updateTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: TemplateUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.evaluationTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบแบบประเมิน");

  const changingSections = input.sections !== undefined;
  if (changingSections && existing.status !== "DRAFT") {
    throw BadRequest("แก้ไขหมวด/คำถามได้เฉพาะแบบประเมินที่ยังเป็นฉบับร่าง");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evaluationTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedById: session.sub,
      },
    });

    if (changingSections) {
      await tx.evaluationTemplateSection.deleteMany({ where: { templateId: id } });
      for (const [si, s] of input.sections!.entries()) {
        await tx.evaluationTemplateSection.create({
          data: {
            templateId: id,
            name: s.name,
            order: s.order ?? si,
            questions: {
              create: s.questions.map((q, qi) => ({
                text: q.text,
                helpText: q.helpText,
                answerType: q.answerType,
                options: q.options as Prisma.InputJsonValue[] | undefined,
                weight: q.weight,
                required: q.required,
                order: q.order ?? qi,
              })),
            },
          },
        });
      }
    }
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_template.update",
    entity: "EvaluationTemplate",
    entityId: id,
    ...meta,
  });

  return { id };
}

export async function deleteTemplate(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.evaluationTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบแบบประเมิน");
  if (existing.status !== "DRAFT") throw BadRequest("ลบได้เฉพาะแบบประเมินที่ยังเป็นฉบับร่าง");

  await prisma.evaluationTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "evaluation_template.delete",
    entity: "EvaluationTemplate",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}

/**
 * Freezes the template's current sections/questions into a snapshot object
 * for a new campaign or schedule run. Only ACTIVE templates may be
 * snapshotted — picking a DRAFT/ARCHIVED one throws instead of silently
 * creating a campaign with the wrong (or no) questions.
 */
export async function getTemplateSnapshot(companyId: string, templateId: string): Promise<CampaignTemplateSnapshot> {
  const template = await prisma.evaluationTemplate.findFirst({
    where: { id: templateId, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      sections: { select: sectionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!template) throw NotFound("ไม่พบแบบประเมิน");
  if (template.status !== "ACTIVE") {
    throw BadRequest('แบบประเมินนี้ยังไม่พร้อมใช้งาน (ต้องเปลี่ยนสถานะเป็น "พร้อมใช้งาน" ก่อน)');
  }

  return {
    templateId: template.id,
    name: template.name,
    description: template.description,
    sections: template.sections as unknown as CampaignTemplateSnapshot["sections"],
  };
}
