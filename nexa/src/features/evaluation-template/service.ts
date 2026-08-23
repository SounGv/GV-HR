import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { TemplateCreateInput, TemplateListQuery, TemplateUpdateInput } from "./schema";
import type { CampaignTemplateSnapshot } from "./types";

type Meta = { ip?: string; userAgent?: string };

const NON_SCORING_ANSWER_TYPES = new Set(["LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"]);

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
      visibleTo: true,
      competencyId: true,
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.EvaluationTemplateSectionSelect;

function totalWeightOf(sections: { questions: { answerType: string; weight: number }[] }[]): number {
  return sections
    .flatMap((s) => s.questions)
    .filter((q) => !NON_SCORING_ANSWER_TYPES.has(q.answerType))
    .reduce((sum, q) => sum + q.weight, 0);
}

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
      version: true,
      evaluationType: true,
      departmentId: true,
      positionId: true,
      clonedFromId: true,
      sections: { select: { questions: { select: { answerType: true, weight: true } }, _count: { select: { questions: true } } } },
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
    version: t.version,
    evaluationType: t.evaluationType,
    departmentId: t.departmentId,
    positionId: t.positionId,
    clonedFromId: t.clonedFromId,
    sectionCount: t._count.sections,
    questionCount: t.sections.reduce((sum, s) => sum + s._count.questions, 0),
    totalWeight: totalWeightOf(t.sections),
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
      version: true,
      evaluationType: true,
      departmentId: true,
      positionId: true,
      clonedFromId: true,
      sections: { select: sectionSelect, orderBy: { order: "asc" } },
      _count: { select: { campaigns: true } },
    },
  });
  if (!template) throw NotFound("ไม่พบแบบประเมิน");

  return {
    ...template,
    sections: template.sections as unknown as CampaignTemplateSnapshot["sections"],
    sectionCount: template.sections.length,
    questionCount: template.sections.reduce((sum, s) => sum + s.questions.length, 0),
    totalWeight: totalWeightOf(template.sections),
    campaignCount: template._count.campaigns,
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
      evaluationType: input.evaluationType,
      departmentId: input.departmentId,
      positionId: input.positionId,
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
              visibleTo: q.visibleTo,
              competencyId: q.competencyId,
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

  // A single nested write (deleteMany + create in the same `update` call)
  // instead of a delete followed by one `create` per section — one round
  // trip instead of N+1, and still atomic without needing $transaction.
  await prisma.evaluationTemplate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.evaluationType !== undefined ? { evaluationType: input.evaluationType } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.positionId !== undefined ? { positionId: input.positionId } : {}),
      updatedById: session.sub,
      ...(changingSections
        ? {
            sections: {
              deleteMany: {},
              create: input.sections!.map((s, si) => ({
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
                    visibleTo: q.visibleTo,
                    competencyId: q.competencyId,
                  })),
                },
              })),
            },
          }
        : {}),
    },
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
 * "คัดลอกแบบประเมิน" — a fresh DRAFT template (version = source.version + 1,
 * clonedFromId = source.id) with every section/question deep-copied,
 * including each question's bank link (competencyId) so it still counts
 * toward that bank item's usage. The source template — and every campaign
 * that already snapshotted it — is completely untouched.
 */
export async function cloneTemplate(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const source = await prisma.evaluationTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      name: true,
      description: true,
      evaluationType: true,
      departmentId: true,
      positionId: true,
      version: true,
      sections: { select: sectionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!source) throw NotFound("ไม่พบแบบประเมิน");

  const clone = await prisma.evaluationTemplate.create({
    data: {
      companyId,
      name: `${source.name} (คัดลอก)`,
      description: source.description,
      evaluationType: source.evaluationType,
      departmentId: source.departmentId,
      positionId: source.positionId,
      version: source.version + 1,
      clonedFromId: id,
      status: "DRAFT",
      createdById: session.sub,
      updatedById: session.sub,
      sections: {
        create: source.sections.map((s) => ({
          name: s.name,
          order: s.order,
          questions: {
            create: s.questions.map((q) => ({
              text: q.text,
              helpText: q.helpText,
              answerType: q.answerType,
              options: q.options as Prisma.InputJsonValue[] | undefined,
              weight: q.weight,
              required: q.required,
              order: q.order,
              visibleTo: q.visibleTo,
              competencyId: q.competencyId,
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
    action: "evaluation_template.clone",
    entity: "EvaluationTemplate",
    entityId: clone.id,
    before: { clonedFromId: id },
    after: { name: `${source.name} (คัดลอก)` },
    ...meta,
  });

  return { id: clone.id };
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
