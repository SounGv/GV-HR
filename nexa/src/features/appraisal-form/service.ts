import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { formProblems, isEditable, nextVersion, type QuestionDraft } from "./rules";
import type { FormCreateInput, FormUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const questionSelect = {
  id: true,
  order: true,
  text: true,
  helpText: true,
  answerType: true,
  options: true,
  weight: true,
  required: true,
  visibleTo: true,
} satisfies Prisma.AppraisalQuestionSelect;

const asOptions = (v: Prisma.JsonValue | null): { value: string; label: string }[] | null =>
  Array.isArray(v) ? (v as { value: string; label: string }[]) : null;

/** One row per form, showing its latest version (a published form with a newer draft shows the draft). */
export async function listForms(companyId: string) {
  const rows = await prisma.appraisalForm.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      lineageId: true,
      version: true,
      name: true,
      status: true,
      updatedAt: true,
      _count: { select: { questions: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = latest.get(r.lineageId);
    if (!cur || r.version > cur.version) latest.set(r.lineageId, r);
  }
  return [...latest.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((r) => ({
      id: r.id,
      lineageId: r.lineageId,
      version: r.version,
      name: r.name,
      status: r.status,
      questionCount: r._count.questions,
      updatedAt: r.updatedAt.toISOString(),
    }));
}

export async function getForm(companyId: string, id: string) {
  const f = await prisma.appraisalForm.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      lineageId: true,
      version: true,
      name: true,
      description: true,
      status: true,
      ratingMax: true,
      publishedAt: true,
      questions: { select: questionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!f) throw NotFound("ไม่พบแบบประเมิน");
  return {
    ...f,
    publishedAt: f.publishedAt?.toISOString() ?? null,
    questions: f.questions.map((q) => ({ ...q, options: asOptions(q.options) })),
  };
}

export async function createForm(companyId: string, session: AccessClaims, input: FormCreateInput, meta?: Meta) {
  const form = await prisma.appraisalForm.create({
    data: {
      companyId,
      lineageId: randomUUID(),
      name: input.name,
      description: input.description ?? null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_form.create",
    entity: "AppraisalForm",
    entityId: form.id,
    after: { name: input.name },
    ...meta,
  });
  return form;
}

/** Saves a DRAFT (name, description and the whole question list). A published form is never edited in place. */
export async function updateForm(companyId: string, session: AccessClaims, id: string, input: FormUpdateInput, meta?: Meta) {
  const existing = await prisma.appraisalForm.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบแบบประเมิน");
  if (!isEditable(existing.status)) {
    throw BadRequest("แบบนี้ถูกใช้งานแล้วแก้ไขไม่ได้ กรุณาสร้างเวอร์ชันใหม่");
  }

  await prisma.appraisalForm.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedById: session.sub,
      ...(input.questions !== undefined
        ? {
            questions: {
              deleteMany: {},
              create: input.questions.map((q, i) => ({
                order: i,
                text: q.text,
                helpText: q.helpText || null,
                answerType: q.answerType,
                options:
                  q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE"
                    ? (q.options ?? []).map((o) => ({ value: o.value, label: o.label }))
                    : undefined,
                weight: q.answerType === "RATING" ? q.weight : 0,
                required: q.required,
                visibleTo: q.visibleTo,
              })),
            },
          }
        : {}),
    },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_form.update",
    entity: "AppraisalForm",
    entityId: id,
    ...meta,
  });
  return { id };
}

/** DRAFT -> PUBLISHED. Refuses a form with problems, and retires the previous published version of the same form. */
export async function publishForm(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const form = await prisma.appraisalForm.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, lineageId: true, questions: { select: questionSelect, orderBy: { order: "asc" } } },
  });
  if (!form) throw NotFound("ไม่พบแบบประเมิน");
  if (form.status !== "DRAFT") throw BadRequest("แบบนี้ถูกใช้งานแล้ว");

  const drafts: QuestionDraft[] = form.questions.map((q) => ({
    text: q.text,
    answerType: q.answerType,
    options: asOptions(q.options),
    weight: q.weight,
  }));
  const problems = formProblems(drafts);
  if (problems.length) throw BadRequest(`ยังยืนยันใช้ไม่ได้: ${problems.join(" · ")}`);

  await prisma.$transaction([
    prisma.appraisalForm.updateMany({
      where: { lineageId: form.lineageId, companyId, status: "PUBLISHED", id: { not: id } },
      data: { status: "ARCHIVED" },
    }),
    prisma.appraisalForm.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date(), updatedById: session.sub },
    }),
  ]);
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_form.publish",
    entity: "AppraisalForm",
    entityId: id,
    ...meta,
  });
  return { id };
}

/** Copies a published form into the next DRAFT version. If that draft already exists, returns it instead of making another. */
export async function createNewVersion(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const source = await prisma.appraisalForm.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      lineageId: true,
      name: true,
      description: true,
      ratingMax: true,
      ratingLabels: true,
      status: true,
      questions: { select: questionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!source) throw NotFound("ไม่พบแบบประเมิน");
  if (source.status === "DRAFT") throw BadRequest("แบบนี้ยังเป็นฉบับร่าง แก้ไขได้เลย");

  const siblings = await prisma.appraisalForm.findMany({
    where: { lineageId: source.lineageId, companyId, deletedAt: null },
    select: { id: true, version: true, status: true },
  });
  const draft = siblings.find((s) => s.status === "DRAFT");
  if (draft) return { id: draft.id };

  const created = await prisma.appraisalForm.create({
    data: {
      companyId,
      lineageId: source.lineageId,
      version: nextVersion(siblings.map((s) => s.version)),
      name: source.name,
      description: source.description,
      ratingMax: source.ratingMax,
      ratingLabels: (source.ratingLabels ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: session.sub,
      updatedById: session.sub,
      questions: {
        create: source.questions.map((q, i) => ({
          order: i,
          text: q.text,
          helpText: q.helpText,
          answerType: q.answerType,
          options: (q.options ?? undefined) as Prisma.InputJsonValue | undefined,
          weight: q.weight,
          required: q.required,
          visibleTo: q.visibleTo,
        })),
      },
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_form.new_version",
    entity: "AppraisalForm",
    entityId: created.id,
    before: { fromId: id },
    ...meta,
  });
  return created;
}

export async function deleteForm(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.appraisalForm.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบแบบประเมิน");
  if (existing.status !== "DRAFT") throw BadRequest("ลบได้เฉพาะแบบประเมินที่ยังเป็นฉบับร่าง");
  await prisma.appraisalForm.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_form.delete",
    entity: "AppraisalForm",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}
