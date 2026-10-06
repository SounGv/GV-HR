import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { isLineConfigured } from "@/lib/integrations/line";
import { createNotification } from "@/features/notification/service";
import { cleanAnswers, summarizeAnswers, unansweredRequired, visibleQuestions, type Answer, type QuestionSummary, type SnapQuestion } from "./answers";
import {
  matchRaters,
  planInvitations,
  roundChecks,
  sendMode,
  shouldRemind,
  type Match,
  type RaterType,
  type RosterPerson,
} from "./rules";
import type { RoundUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();
const fmtDay = (isoDay: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
const asWeights = (v: Prisma.JsonValue | null): Partial<Record<RaterType, number>> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<RaterType, number>>) : {};

/* ───────────────────────────── HR side ───────────────────────────── */

export async function listRounds(companyId: string) {
  const rounds = await prisma.appraisalRound.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      form: { select: { name: true, version: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const out = [];
  // Sequential, not Promise.all — connection_limit=1.
  for (const r of rounds) {
    let submitted = 0;
    let total = 0;
    if (r.status === "OPEN" || r.status === "CLOSED") {
      const groups = await prisma.appraisalAssignment.groupBy({
        by: ["status"],
        where: { participant: { roundId: r.id } },
        _count: { _all: true },
      });
      for (const g of groups) {
        total += g._count._all;
        if (g.status === "SUBMITTED") submitted += g._count._all;
      }
    }
    out.push({
      id: r.id,
      name: r.name,
      status: r.status,
      formName: `${r.form.name} v${r.form.version}`,
      startIso: r.startDate ? iso(r.startDate) : null,
      endIso: r.endDate ? iso(r.endDate) : null,
      participantCount: r._count.participants,
      submitted,
      total,
    });
  }
  return out;
}

/** Active employees HR can pick as people to evaluate. */
export async function listCandidates(companyId: string) {
  const rows = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      managerId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { employeeCode: "asc" }],
  });
  return rows.map((e) => ({
    id: e.id,
    code: e.employeeCode,
    name: fullName(e),
    departmentId: e.department?.id ?? null,
    department: e.department?.name ?? "ไม่ระบุแผนก",
    hasManager: !!e.managerId,
  }));
}

export async function createRound(companyId: string, session: AccessClaims, name: string, meta?: Meta) {
  const published = await prisma.appraisalForm.findFirst({
    where: { companyId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });
  if (!published) throw BadRequest("ยังไม่มีแบบประเมินที่ใช้งานแล้ว กรุณาสร้างและยืนยันใช้แบบประเมินก่อน");
  const round = await prisma.appraisalRound.create({
    data: { companyId, name, formId: published.id, createdById: session.sub, updatedById: session.sub },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.create",
    entity: "AppraisalRound",
    entityId: round.id,
    after: { name },
    ...meta,
  });
  return round;
}

async function loadDraft(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  return round;
}

export async function updateRound(companyId: string, session: AccessClaims, id: string, input: RoundUpdateInput, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "DRAFT") throw BadRequest("รอบนี้เปิดแล้ว แก้ไขไม่ได้");

  if (input.formId) {
    const form = await prisma.appraisalForm.findFirst({
      where: { id: input.formId, companyId, deletedAt: null, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!form) throw BadRequest("เลือกได้เฉพาะแบบประเมินที่ใช้งานแล้ว");
  }

  await prisma.appraisalRound.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.formId !== undefined ? { formId: input.formId } : {}),
      ...(input.raterTypes !== undefined ? { raterTypes: input.raterTypes } : {}),
      ...(input.perspectiveWeights !== undefined ? { perspectiveWeights: input.perspectiveWeights } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null } : {}),
      ...(input.remind !== undefined ? { remind: input.remind } : {}),
      ...(input.notifyLine !== undefined ? { notifyLine: input.notifyLine } : {}),
      updatedById: session.sub,
    },
  });

  if (input.participantIds) {
    const people = await prisma.employee.findMany({
      where: { id: { in: input.participantIds }, companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, department: { select: { name: true } }, position: { select: { title: true } } },
    });
    const keep = new Set(people.map((p) => p.id));
    await prisma.appraisalParticipant.deleteMany({ where: { roundId: id, employeeId: { notIn: [...keep] } } });
    const existing = new Set(
      (await prisma.appraisalParticipant.findMany({ where: { roundId: id }, select: { employeeId: true } })).map((p) => p.employeeId),
    );
    await prisma.appraisalParticipant.createMany({
      data: people
        .filter((p) => !existing.has(p.id))
        .map((p) => ({
          roundId: id,
          employeeId: p.id,
          departmentName: p.department?.name ?? null,
          positionName: p.position?.title ?? null,
        })),
      skipDuplicates: true,
    });
  }

  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.update", entity: "AppraisalRound", entityId: id, ...meta });
  return { id };
}

async function loadRoster(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, managerId: true, status: true, firstName: true, lastName: true, userId: true, lineUserId: true },
  });
}

/** Everything the wizard shows for one round: the saved choices, the matching result and the readiness list. */
export async function getRound(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      formId: true,
      form: { select: { name: true, version: true, status: true } },
      raterTypes: true,
      perspectiveWeights: true,
      startDate: true,
      endDate: true,
      remind: true,
      notifyLine: true,
      openedAt: true,
      notifiedAt: true,
      participants: { select: { employeeId: true } },
    },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");

  const roster = await loadRoster(companyId);
  const nameOf = new Map(roster.map((e) => [e.id, fullName(e)]));
  const participantIds = round.participants.map((p) => p.employeeId);
  const types = round.raterTypes as RaterType[];
  const weights = asWeights(round.perspectiveWeights);

  const people: RosterPerson[] = roster.map((e) => ({ id: e.id, managerId: e.managerId, active: e.status === "ACTIVE" }));
  const match = matchRaters(participantIds, people, types);
  const withoutRater = match.exceptions.filter((e) => e.kind === "NO_RATER").length;

  const reachable = new Set(roster.filter((e) => e.userId).map((e) => e.id));
  const lineLinked = isLineConfigured() ? new Set(roster.filter((e) => e.lineUserId).map((e) => e.id)) : new Set<string>();
  const plan = planInvitations(match.matches, lineLinked, reachable);
  const unreachableNames = plan.lines.filter((l) => !reachable.has(l.raterId)).map((l) => nameOf.get(l.raterId) ?? "-");

  const startIso = round.startDate ? iso(round.startDate) : null;
  const endIso = round.endDate ? iso(round.endDate) : null;
  const checks = roundChecks({
    formPublished: round.form.status === "PUBLISHED",
    participantCount: participantIds.length,
    raterTypes: types,
    weights,
    withoutRater,
    startIso,
    endIso,
  });

  const byType = new Map<string, number>();
  for (const m of match.matches) byType.set(m.raterType, (byType.get(m.raterType) ?? 0) + 1);

  return {
    id: round.id,
    name: round.name,
    status: round.status,
    formId: round.formId,
    formName: `${round.form.name} v${round.form.version}`,
    raterTypes: types,
    perspectiveWeights: weights,
    startIso,
    endIso,
    remind: round.remind,
    notifyLine: round.notifyLine,
    openedAt: round.openedAt?.toISOString() ?? null,
    notifiedAt: round.notifiedAt?.toISOString() ?? null,
    participantIds,
    matching: {
      assignmentCount: match.matches.length,
      byType: Object.fromEntries(byType),
      exceptions: match.exceptions.map((e) => ({ kind: e.kind, employeeId: e.employeeId, name: nameOf.get(e.employeeId) ?? "-", detail: e.detail ?? null })),
    },
    invitations: {
      total: plan.total,
      withLine: plan.withLine,
      appOnly: plan.appOnly,
      unreachable: plan.unreachable,
      unreachableNames,
      lineConfigured: isLineConfigured(),
    },
    checks,
    ready: checks.every((c) => c.ok),
  };
}

export async function listPublishedForms(companyId: string) {
  const forms = await prisma.appraisalForm.findMany({
    where: { companyId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true, name: true, version: true, _count: { select: { questions: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return forms.map((f) => ({ id: f.id, name: `${f.name} v${f.version}`, questionCount: f._count.questions }));
}

/** Progress of a round that is open or closed: submitted / in progress / not started, overall and per rater type. */
export async function getRoundProgress(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const groups = await prisma.appraisalAssignment.groupBy({
    by: ["raterType", "status"],
    where: { participant: { roundId: id } },
    _count: { _all: true },
  });
  const sum = (pred: (g: (typeof groups)[number]) => boolean) =>
    groups.filter(pred).reduce((n, g) => n + g._count._all, 0);
  return {
    total: sum(() => true),
    submitted: sum((g) => g.status === "SUBMITTED"),
    inProgress: sum((g) => g.status === "IN_PROGRESS"),
    pending: sum((g) => g.status === "PENDING"),
  };
}

/** Opens the round: refuses when anything is missing, freezes the form, creates the assignments and (if the start day has come) sends the invitations. */
export async function openRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const detail = await getRound(companyId, id);
  if (detail.status !== "DRAFT") throw BadRequest("รอบนี้เปิดแล้ว");
  const failed = detail.checks.filter((c) => !c.ok);
  if (failed.length) throw BadRequest(`ยังเปิดรอบไม่ได้: ${failed.map((c) => c.why).join(" · ")}`);

  const form = await prisma.appraisalForm.findFirst({
    where: { id: detail.formId, companyId, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      name: true,
      version: true,
      ratingMax: true,
      ratingLabels: true,
      questions: {
        select: { id: true, order: true, text: true, helpText: true, answerType: true, options: true, weight: true, required: true, visibleTo: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!form) throw BadRequest("แบบประเมินไม่พร้อมใช้งาน");

  const roster = await loadRoster(companyId);
  const people: RosterPerson[] = roster.map((e) => ({ id: e.id, managerId: e.managerId, active: e.status === "ACTIVE" }));
  const { matches } = matchRaters(detail.participantIds, people, detail.raterTypes);

  const participants = await prisma.appraisalParticipant.findMany({ where: { roundId: id }, select: { id: true, employeeId: true } });
  const pidByEmployee = new Map(participants.map((p) => [p.employeeId, p.id]));
  const mode = sendMode(detail.startIso as string, iso(bangkokParts().dateUTC));

  await prisma.$transaction([
    prisma.appraisalAssignment.deleteMany({ where: { participant: { roundId: id } } }),
    prisma.appraisalAssignment.createMany({
      data: matches.map((m) => ({
        participantId: pidByEmployee.get(m.participantId) as string,
        raterEmployeeId: m.raterId,
        raterType: m.raterType,
      })),
      skipDuplicates: true,
    }),
    prisma.appraisalRound.update({
      where: { id },
      data: {
        status: mode === "NOW" ? "OPEN" : "SCHEDULED",
        openedAt: new Date(),
        formSnapshot: form as unknown as Prisma.InputJsonValue,
        updatedById: session.sub,
      },
    }),
  ]);
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.open",
    entity: "AppraisalRound",
    entityId: id,
    after: { assignments: matches.length, mode },
    ...meta,
  });

  const sent = mode === "NOW" ? await sendInvitations(companyId, id, session.sub) : null;
  return { id, mode, assignments: matches.length, sent };
}

/**
 * One message per rater (in-app inbox, plus LINE when the round has it on and the rater linked it).
 * Only assignments not yet notified are included, so running it twice never messages anyone twice.
 */
export async function sendInvitations(companyId: string, roundId: string, actorUserId?: string | null) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id: roundId, companyId, deletedAt: null },
    select: { id: true, name: true, endDate: true, notifyLine: true, status: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");

  const pending = await prisma.appraisalAssignment.findMany({
    where: { participant: { roundId }, notifiedAt: null },
    select: { id: true, raterEmployeeId: true, participantId: true },
  });
  const byRater = new Map<string, { ids: string[]; people: Set<string> }>();
  for (const a of pending) {
    const cur = byRater.get(a.raterEmployeeId) ?? { ids: [], people: new Set<string>() };
    cur.ids.push(a.id);
    cur.people.add(a.participantId);
    byRater.set(a.raterEmployeeId, cur);
  }

  const endText = round.endDate ? ` ปิดรอบวันที่ ${fmtDay(iso(round.endDate))}` : "";
  let sent = 0;
  let failed = 0;
  for (const [raterId, v] of byRater) {
    try {
      await createNotification(
        companyId,
        raterId,
        {
          title: `ถึงรอบประเมิน: ${round.name}`,
          body: `คุณมี ${v.people.size} คนที่ต้องประเมิน${endText}`,
          category: "evaluation",
          link: "/appraisal/tasks",
          line: round.notifyLine,
        },
        actorUserId,
      );
      await prisma.appraisalAssignment.updateMany({ where: { id: { in: v.ids } }, data: { notifiedAt: new Date() } });
      sent++;
    } catch {
      failed++;
    }
  }
  await prisma.appraisalRound.update({
    where: { id: roundId },
    data: { notifiedAt: new Date(), ...(round.status === "SCHEDULED" ? { status: "OPEN" } : {}) },
  });
  return { sent, failed };
}

export async function closeRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "OPEN" && round.status !== "SCHEDULED") throw BadRequest("ปิดได้เฉพาะรอบที่เปิดอยู่");
  await prisma.appraisalRound.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.close", entity: "AppraisalRound", entityId: id, ...meta });
  return { id };
}

/**
 * "สร้างรอบจากรอบเดิม": a new DRAFT with the same form, people, rater types, weights and options.
 * Dates are left empty (a new period) and nothing is sent. People who have left since are not copied.
 * A form that is no longer published is replaced by the newest published version of the same form.
 */
export async function cloneRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const src = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      name: true,
      raterTypes: true,
      perspectiveWeights: true,
      remind: true,
      notifyLine: true,
      form: { select: { id: true, lineageId: true, status: true } },
      participants: { select: { employeeId: true } },
    },
  });
  if (!src) throw NotFound("ไม่พบรอบประเมิน");

  const published = src.form.status === "PUBLISHED"
    ? src.form
    : await prisma.appraisalForm.findFirst({
        where: { companyId, lineageId: src.form.lineageId, status: "PUBLISHED", deletedAt: null },
        select: { id: true, lineageId: true, status: true },
        orderBy: { version: "desc" },
      });
  if (!published) throw BadRequest("แบบประเมินของรอบนี้ไม่ได้ใช้งานแล้ว และยังไม่มีเวอร์ชันใหม่ที่ยืนยันใช้ กรุณาสร้างรอบใหม่แทน");

  const people = await prisma.employee.findMany({
    where: { id: { in: src.participants.map((p) => p.employeeId) }, companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, department: { select: { name: true } }, position: { select: { title: true } } },
  });
  const created = await prisma.appraisalRound.create({
    data: {
      companyId,
      name: `${src.name} (สำเนา)`,
      formId: published.id,
      raterTypes: src.raterTypes,
      perspectiveWeights: (src.perspectiveWeights ?? undefined) as Prisma.InputJsonValue | undefined,
      remind: src.remind,
      notifyLine: src.notifyLine,
      createdById: session.sub,
      updatedById: session.sub,
      participants: {
        create: people.map((p) => ({
          employeeId: p.id,
          departmentName: p.department?.name ?? null,
          positionName: p.position?.title ?? null,
        })),
      },
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.clone",
    entity: "AppraisalRound",
    entityId: created.id,
    before: { fromId: id },
    after: { participants: people.length },
    ...meta,
  });
  return created;
}

/** Takes a SCHEDULED round back to a draft (nothing has been sent yet), so it can be edited again. */
export async function unscheduleRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "SCHEDULED") throw BadRequest("ยกเลิกการตั้งเวลาได้เฉพาะรอบที่ตั้งเวลาไว้และยังไม่ได้ส่งข้อความ");
  await prisma.$transaction([
    prisma.appraisalAssignment.deleteMany({ where: { participant: { roundId: id } } }),
    prisma.appraisalRound.update({
      where: { id },
      data: { status: "DRAFT", openedAt: null, formSnapshot: undefined, updatedById: session.sub },
    }),
  ]);
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.unschedule", entity: "AppraisalRound", entityId: id, ...meta });
  return { id };
}

export async function deleteRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "DRAFT") throw BadRequest("ลบได้เฉพาะรอบที่ยังเป็นฉบับร่าง");
  await prisma.appraisalRound.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.delete", entity: "AppraisalRound", entityId: id, ...meta });
}

/* ───────────────────────────── Tracking and results ───────────────────────────── */

/** "ตรวจเช็คการประเมิน": every person in the round with the status of each of their raters. */
export async function getRoundMatrix(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const rows = await prisma.appraisalParticipant.findMany({
    where: { roundId: id },
    select: {
      id: true,
      departmentName: true,
      employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      assignments: {
        select: { id: true, raterType: true, status: true, rater: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { employee: { employeeCode: "asc" } },
    take: 2000,
  });
  return rows.map((p) => ({
    participantId: p.id,
    name: fullName(p.employee),
    code: p.employee.employeeCode,
    department: p.departmentName ?? "ไม่ระบุแผนก",
    assignments: p.assignments.map((a) => ({
      id: a.id,
      raterType: a.raterType,
      status: a.status,
      raterName: fullName(a.rater),
    })),
  }));
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  code: string;
  department: string;
  roundName: string;
  roundStatus: string;
  groups: { raterType: string; total: number; submitted: number; summary: QuestionSummary[] }[];
}

/**
 * Answers for one person, grouped by rater type. Only submitted answers are summarised, and nobody's
 * name is attached to what they wrote. Averages are plain means: no weighting, grade or overall score yet.
 */
export async function getParticipantResult(companyId: string, roundId: string, participantId: string): Promise<ParticipantResult> {
  const p = await prisma.appraisalParticipant.findFirst({
    where: { id: participantId, roundId, round: { companyId, deletedAt: null } },
    select: {
      id: true,
      departmentName: true,
      employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      round: { select: { name: true, status: true, formSnapshot: true } },
      assignments: { select: { raterType: true, status: true, answers: true, submittedAt: true }, orderBy: { submittedAt: "asc" } },
    },
  });
  if (!p) throw NotFound("ไม่พบข้อมูล");
  const snap = p.round.formSnapshot as unknown as { questions: SnapQuestion[] } | null;
  const questions = snap?.questions ?? [];
  const types = [...new Set(p.assignments.map((a) => a.raterType))];
  return {
    participantId: p.id,
    name: fullName(p.employee),
    code: p.employee.employeeCode,
    department: p.departmentName ?? "ไม่ระบุแผนก",
    roundName: p.round.name,
    roundStatus: p.round.status,
    groups: types.map((t) => {
      const mine = p.assignments.filter((a) => a.raterType === t);
      const done = mine.filter((a) => a.status === "SUBMITTED");
      return {
        raterType: t,
        total: mine.length,
        submitted: done.length,
        summary: summarizeAnswers(questions, t, done.map((a) => (Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : []))),
      };
    }),
  };
}

/** Submitted / total assignments per department of the people being evaluated, for the overview bars. */
export async function getRoundDepartmentProgress(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const rows = await prisma.appraisalAssignment.findMany({
    where: { participant: { roundId: id } },
    select: { status: true, participant: { select: { departmentName: true } } },
  });
  const byDept = new Map<string, { submitted: number; total: number }>();
  for (const r of rows) {
    const name = r.participant.departmentName ?? "ไม่ระบุแผนก";
    const cur = byDept.get(name) ?? { submitted: 0, total: 0 };
    cur.total++;
    if (r.status === "SUBMITTED") cur.submitted++;
    byDept.set(name, cur);
  }
  return [...byDept.entries()]
    .map(([department, v]) => ({ department, ...v, percent: v.total ? Math.round((v.submitted / v.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent || a.department.localeCompare(b.department, "th"));
}

/* ───────────────────────────── Rater side ───────────────────────────── */

function requireEmployee(session: AccessClaims): string {
  if (!session.employeeId) throw Forbidden("บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  return session.employeeId;
}

export async function listMyAssignments(companyId: string, session: AccessClaims) {
  const employeeId = requireEmployee(session);
  const rows = await prisma.appraisalAssignment.findMany({
    where: { raterEmployeeId: employeeId, participant: { round: { companyId, deletedAt: null, status: { in: ["OPEN", "CLOSED"] } } } },
    select: {
      id: true,
      raterType: true,
      status: true,
      participant: {
        select: {
          employee: { select: { firstName: true, lastName: true, employeeCode: true } },
          round: { select: { id: true, name: true, status: true, endDate: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 300,
  });
  return rows.map((r) => ({
    id: r.id,
    raterType: r.raterType,
    status: r.status,
    personName: fullName(r.participant.employee),
    personCode: r.participant.employee.employeeCode,
    roundId: r.participant.round.id,
    roundName: r.participant.round.name,
    roundStatus: r.participant.round.status,
    endIso: r.participant.round.endDate ? iso(r.participant.round.endDate) : null,
  }));
}

async function loadMine(companyId: string, session: AccessClaims, id: string) {
  const employeeId = requireEmployee(session);
  const a = await prisma.appraisalAssignment.findFirst({
    where: { id, raterEmployeeId: employeeId, participant: { round: { companyId, deletedAt: null } } },
    select: {
      id: true,
      raterType: true,
      status: true,
      answers: true,
      participant: {
        select: {
          employee: { select: { firstName: true, lastName: true, employeeCode: true } },
          round: { select: { id: true, name: true, status: true, endDate: true, formSnapshot: true } },
        },
      },
    },
  });
  if (!a) throw NotFound("ไม่พบงานประเมินนี้");
  const snap = a.participant.round.formSnapshot as unknown as { ratingMax: number; questions: SnapQuestion[] } | null;
  if (!snap) throw BadRequest("รอบนี้ยังไม่พร้อม");
  return { a, snap };
}

export async function getMyAssignment(companyId: string, session: AccessClaims, id: string) {
  const { a, snap } = await loadMine(companyId, session, id);
  return {
    id: a.id,
    raterType: a.raterType,
    status: a.status,
    personName: fullName(a.participant.employee),
    personCode: a.participant.employee.employeeCode,
    roundName: a.participant.round.name,
    roundStatus: a.participant.round.status,
    endIso: a.participant.round.endDate ? iso(a.participant.round.endDate) : null,
    ratingMax: snap.ratingMax,
    questions: visibleQuestions(snap.questions, a.raterType),
    answers: (Array.isArray(a.answers) ? a.answers : []) as unknown as Answer[],
  };
}

/** Saves a draft, or submits when `submit` is true (every required question must be answered; a submitted form is final). */
export async function saveMyAnswers(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: { answers: { questionId: string; value: unknown }[]; submit: boolean },
  meta?: Meta,
) {
  const { a, snap } = await loadMine(companyId, session, id);
  if (a.participant.round.status !== "OPEN") throw BadRequest("รอบนี้ปิดแล้ว");
  if (a.status === "SUBMITTED") throw BadRequest("ส่งผลประเมินแล้ว แก้ไขไม่ได้");

  const answers = cleanAnswers(snap.questions, a.raterType, input.answers, snap.ratingMax);
  if (input.submit) {
    const missing = unansweredRequired(snap.questions, a.raterType, answers);
    if (missing.length) throw BadRequest(`ยังตอบไม่ครบ: ${missing.join(", ")}`);
  }
  await prisma.appraisalAssignment.update({
    where: { id },
    data: {
      answers: answers as unknown as Prisma.InputJsonValue,
      status: input.submit ? "SUBMITTED" : "IN_PROGRESS",
      startedAt: a.status === "PENDING" ? new Date() : undefined,
      submittedAt: input.submit ? new Date() : null,
    },
  });
  if (input.submit) {
    await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_assignment.submit", entity: "AppraisalAssignment", entityId: id, ...meta });
  }
  return { id, status: input.submit ? "SUBMITTED" : "IN_PROGRESS", answered: answers.length };
}

/* ───────────────────────────── Reminders and daily job ───────────────────────────── */

/**
 * Messages every rater who still has unsubmitted work in an OPEN round (one message per rater),
 * skipping anyone already reminded within `minGapHours`. Returns how many raters were messaged.
 */
async function remindUnsubmitted(
  r: { id: string; companyId: string; name: string; endDate: Date | null; notifyLine: boolean },
  minGapHours: number,
): Promise<number> {
  const since = new Date(Date.now() - minGapHours * 3_600_000);
  const todo = await prisma.appraisalAssignment.findMany({
    where: {
      participant: { roundId: r.id },
      status: { not: "SUBMITTED" },
      notifiedAt: { not: null },
      OR: [{ remindedAt: null }, { remindedAt: { lt: since } }],
    },
    select: { id: true, raterEmployeeId: true, participantId: true },
  });
  const byRater = new Map<string, { ids: string[]; people: Set<string> }>();
  for (const a of todo) {
    const cur = byRater.get(a.raterEmployeeId) ?? { ids: [], people: new Set<string>() };
    cur.ids.push(a.id);
    cur.people.add(a.participantId);
    byRater.set(a.raterEmployeeId, cur);
  }
  const endText = r.endDate ? ` ปิดรอบวันที่ ${fmtDay(iso(r.endDate))}` : "";
  let reminded = 0;
  for (const [raterId, v] of byRater) {
    try {
      await createNotification(r.companyId, raterId, {
        title: `เตือน: ${r.name}`,
        body: `ยังเหลือ ${v.people.size} คนที่ต้องประเมิน${endText}`,
        category: "evaluation",
        link: "/appraisal/tasks",
        line: r.notifyLine,
      });
      await prisma.appraisalAssignment.updateMany({ where: { id: { in: v.ids } }, data: { remindedAt: new Date() } });
      reminded++;
    } catch {
      /* one failed reminder must not stop the rest */
    }
  }
  return reminded;
}

/** The "เตือนทุกคน" button: remind everyone who has not submitted, at most once an hour each. */
export async function remindAll(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const r = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, companyId: true, name: true, endDate: true, notifyLine: true, status: true },
  });
  if (!r) throw NotFound("ไม่พบรอบประเมิน");
  if (r.status !== "OPEN") throw BadRequest("เตือนได้เฉพาะรอบที่เปิดอยู่");
  const reminded = await remindUnsubmitted(r, 1);
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.remind_all", entity: "AppraisalRound", entityId: id, after: { reminded }, ...meta });
  return { reminded };
}

/**
 * Run once a day by the cron route: opens scheduled rounds whose start day has come
 * (sending their invitations), then reminds raters who have not submitted yet when a
 * round closes within REMIND_BEFORE_DAYS. A rater is reminded at most once a day.
 */
export async function runRoundJobs() {
  const todayIso = iso(bangkokParts().dateUTC);
  const summary = { opened: 0, invitationsSent: 0, reminded: 0 };

  const due = await prisma.appraisalRound.findMany({
    where: { deletedAt: null, status: "SCHEDULED", startDate: { lte: new Date(`${todayIso}T00:00:00Z`) } },
    select: { id: true, companyId: true },
  });
  for (const r of due) {
    const res = await sendInvitations(r.companyId, r.id);
    summary.opened++;
    summary.invitationsSent += res.sent;
  }

  const open = await prisma.appraisalRound.findMany({
    where: { deletedAt: null, status: "OPEN", remind: true, endDate: { not: null } },
    select: { id: true, companyId: true, name: true, endDate: true, notifyLine: true },
  });
  for (const r of open) {
    if (!r.endDate || !shouldRemind(iso(r.endDate), todayIso)) continue;
    summary.reminded += await remindUnsubmitted(r, 20);
  }
  return summary;
}

export type { Match };
