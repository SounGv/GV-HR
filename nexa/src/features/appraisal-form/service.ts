import { randomUUID } from "node:crypto";
import { DEFAULT_PRESET, LABEL_PRESETS, parseRatingLabels } from "./rating-labels";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { cleanLevels, formProblems, isEditable, nextVersion, type QuestionDraft } from "./rules";
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
  levelDescriptions: true,
  section: true,
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
      ratingLabels: true,
      noteAtLowest: true,
      publishedAt: true,
      questions: { select: questionSelect, orderBy: { order: "asc" } },
    },
  });
  if (!f) throw NotFound("ไม่พบแบบประเมิน");
  return {
    ...f,
    ratingLabels: parseRatingLabels(f.ratingLabels, f.ratingMax),
    publishedAt: f.publishedAt?.toISOString() ?? null,
    questions: f.questions.map((q) => ({ ...q, options: asOptions(q.options), levelDescriptions: cleanLevels(q.levelDescriptions, f.ratingMax) })),
  };
}

export async function createForm(companyId: string, session: AccessClaims, input: FormCreateInput, meta?: Meta) {
  const form = await prisma.appraisalForm.create({
    data: {
      companyId,
      lineageId: randomUUID(),
      name: input.name,
      description: input.description ?? null,
      // New forms start with the score names HR set; the builder lets them switch.
      ratingLabels: LABEL_PRESETS[DEFAULT_PRESET].labels.map((l) => ({ ...l })),
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
    select: { id: true, status: true, ratingMax: true },
  });
  if (!existing) throw NotFound("ไม่พบแบบประเมิน");
  if (!isEditable(existing.status)) {
    throw BadRequest("แบบนี้ถูกใช้งานแล้วแก้ไขไม่ได้ กรุณาสร้างเวอร์ชันใหม่");
  }

  // A draft may change its number of scores; names and descriptions are then read against the new scale.
  const ratingMax = input.ratingMax ?? existing.ratingMax;
  // Score names: null = back to the system names; otherwise one name for every score.
  const labels = input.ratingLabels === undefined ? undefined : input.ratingLabels === null ? null : parseRatingLabels(input.ratingLabels, ratingMax);
  if (input.ratingLabels && !labels) throw BadRequest(`ตั้งชื่อระดับคะแนนให้ครบทั้ง ${ratingMax} ระดับ`);

  await prisma.appraisalForm.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(labels !== undefined ? { ratingLabels: labels === null ? Prisma.DbNull : (labels as unknown as Prisma.InputJsonValue) } : {}),
      ...(input.noteAtLowest !== undefined ? { noteAtLowest: input.noteAtLowest } : {}),
      ...(input.ratingMax !== undefined ? { ratingMax: input.ratingMax } : {}),
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
                section: q.section?.trim() || null,
                levelDescriptions:
                  q.answerType === "RATING"
                    ? ((cleanLevels(q.levelDescriptions, ratingMax) ?? undefined) as Prisma.InputJsonValue | undefined)
                    : undefined,
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
    select: { id: true, status: true, lineageId: true, ratingMax: true, questions: { select: questionSelect, orderBy: { order: "asc" } } },
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
  // Every published question goes into the bank (best effort: publishing never fails because of it).
  try {
    await saveToBank(companyId, session, form.ratingMax, form.questions);
  } catch {
    /* the form is published; the bank can be filled next time */
  }
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
      noteAtLowest: true,
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
      noteAtLowest: source.noteAtLowest,
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
          section: q.section,
          levelDescriptions: (q.levelDescriptions ?? undefined) as Prisma.InputJsonValue | undefined,
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

/* ───────────────────────────── Question bank (คลังหัวข้อ) ───────────────────────────── */

type BankSource = {
  text: string;
  helpText: string | null;
  section: string | null;
  answerType: Prisma.AppraisalQuestionGetPayload<{ select: { answerType: true } }>["answerType"];
  levelDescriptions: Prisma.JsonValue | null;
};

/**
 * Adds or refreshes one bank entry per question (matched by its wording). A newer form's
 * help text, section and score descriptions win when it has them. Sequential on purpose
 * (connection pool of 1).
 */
async function saveToBank(companyId: string, session: AccessClaims, scaleMax: number, questions: BankSource[]) {
  for (const q of questions) {
    const text = q.text.trim();
    if (!text) continue;
    const levels = q.answerType === "RATING" ? cleanLevels(q.levelDescriptions, scaleMax) : null;
    const found = await prisma.appraisalQuestionBank.findFirst({
      where: { companyId, text, answerType: q.answerType, deletedAt: null },
      select: { id: true },
    });
    if (found) {
      await prisma.appraisalQuestionBank.update({
        where: { id: found.id },
        data: {
          ...(q.helpText ? { helpText: q.helpText } : {}),
          ...(q.section ? { section: q.section } : {}),
          ...(levels ? { levelDescriptions: levels as unknown as Prisma.InputJsonValue, scaleMax } : {}),
          usedCount: { increment: 1 },
        },
      });
    } else {
      await prisma.appraisalQuestionBank.create({
        data: {
          companyId,
          text,
          helpText: q.helpText,
          section: q.section,
          answerType: q.answerType,
          levelDescriptions: (levels ?? undefined) as Prisma.InputJsonValue | undefined,
          scaleMax,
          usedCount: 1,
          createdById: session.sub,
        },
      });
    }
  }
}

/** The bank, most used first. */
export async function listBank(companyId: string) {
  const rows = await prisma.appraisalQuestionBank.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ usedCount: "desc" }, { updatedAt: "desc" }],
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    helpText: r.helpText,
    section: r.section,
    answerType: r.answerType,
    levelDescriptions: cleanLevels(r.levelDescriptions, r.scaleMax),
    scaleMax: r.scaleMax,
    usedCount: r.usedCount,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Takes one entry out of the bank (forms that already copied it keep their copy). */
export async function removeFromBank(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const row = await prisma.appraisalQuestionBank.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, text: true } });
  if (!row) throw NotFound("ไม่พบหัวข้อในคลัง");
  await prisma.appraisalQuestionBank.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_bank.remove",
    entity: "AppraisalQuestionBank",
    entityId: id,
    before: { text: row.text },
    ...meta,
  });
  return { id };
}
