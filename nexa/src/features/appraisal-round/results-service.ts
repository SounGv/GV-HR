import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { createNotification } from "@/features/notification/service";
import { cleanAnswers, summarizeAnswers, unansweredRequired, visibleQuestions, type Answer, type SnapQuestion } from "./answers";
import { pickForm, type RoundSnapshot } from "./form-snapshot";
import { bandsProblem, computeResult, type Band, type CalcMode, type PersonResult } from "./scoring";

type Meta = { ip?: string; userAgent?: string };

/** A group of peers or subordinates is only shown on its own once at least this many have answered, so nobody can be identified. */
export const ANON_MIN = 3;
/** These are the people who can be identified whatever the group size (they are one person by definition). */
const NAMED_TYPES = new Set(["SELF", "MANAGER"]);

export interface AppraisalSettingsView {
  configured: boolean;
  calcMode: CalcMode;
  bands: Band[];
  approvalLevels: number;
  employeeSees: "NEVER" | "AFTER_PUBLISH";
  ackRequired: boolean;
  ackDays: number | null;
}

const DEFAULTS: AppraisalSettingsView = {
  configured: false,
  calcMode: "WEIGHTED",
  bands: [],
  approvalLevels: 0,
  employeeSees: "NEVER",
  ackRequired: false,
  ackDays: null,
};

const asBands = (v: Prisma.JsonValue | null): Band[] =>
  Array.isArray(v)
    ? (v as { label?: unknown; minPercent?: unknown }[])
        .filter((b) => typeof b.label === "string" && typeof b.minPercent === "number")
        .map((b) => ({ label: b.label as string, minPercent: b.minPercent as number }))
    : [];

export async function getSettings(companyId: string): Promise<AppraisalSettingsView> {
  const row = await prisma.appraisalSettings.findUnique({ where: { companyId } });
  if (!row) return DEFAULTS;
  return {
    configured: true,
    calcMode: row.calcMode,
    bands: asBands(row.bands),
    approvalLevels: row.approvalLevels,
    employeeSees: row.employeeSees,
    ackRequired: row.ackRequired,
    ackDays: row.ackDays,
  };
}

export async function saveSettings(
  companyId: string,
  session: AccessClaims,
  input: Omit<AppraisalSettingsView, "configured">,
  meta?: Meta,
) {
  const problem = bandsProblem(input.bands);
  if (problem) throw BadRequest(problem);
  if (input.ackRequired && !(input.ackDays && input.ackDays > 0)) throw BadRequest("ถ้าต้องรับทราบผล กรุณาระบุจำนวนวัน");

  // Results that were already approved or shown to people are not recalculated under new rules.
  const frozen = await prisma.appraisalParticipant.count({
    where: { round: { companyId, deletedAt: null }, resultStatus: { in: ["APPROVED", "PUBLISHED", "ACKNOWLEDGED"] } },
  });
  const current = await getSettings(companyId);
  const scoringChanged =
    current.calcMode !== input.calcMode || JSON.stringify(current.bands) !== JSON.stringify(input.bands);
  if (frozen > 0 && scoringChanged) {
    throw BadRequest(`มีผลที่อนุมัติหรือประกาศแล้ว ${frozen} คน จึงเปลี่ยนวิธีคิดคะแนนหรือเกณฑ์เกรดไม่ได้`);
  }

  const data = {
    calcMode: input.calcMode,
    bands: input.bands as unknown as Prisma.InputJsonValue,
    approvalLevels: input.approvalLevels,
    employeeSees: input.employeeSees,
    ackRequired: input.ackRequired,
    ackDays: input.ackRequired ? input.ackDays : null,
    updatedById: session.sub,
  };
  await prisma.appraisalSettings.upsert({ where: { companyId }, create: { companyId, ...data }, update: data });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_settings.update", entity: "AppraisalSettings", entityId: companyId, after: input, ...meta });
  return getSettings(companyId);
}

/* ───────────────────────── calculate ───────────────────────── */

const weightsOf = (v: Prisma.JsonValue | null): Partial<Record<string, number>> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<string, number>>) : {};

/**
 * Works out the score of everyone in an open or closed round from the answers submitted so far, and stores it
 * (percentage, score on the form's own scale, grade, and how each perspective contributed). It can be run again
 * any time before a result is approved. People whose result is already approved or shown are left as they are.
 */
export async function calculateRound(companyId: string, session: AccessClaims, roundId: string, meta?: Meta) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id: roundId, companyId, deletedAt: null },
    select: { id: true, status: true, perspectiveWeights: true, formSnapshot: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  if (round.status !== "OPEN" && round.status !== "CLOSED") throw BadRequest("คำนวณผลได้เฉพาะรอบที่เปิดอยู่หรือปิดแล้ว");
  const settings = await getSettings(companyId);
  const snapshot = round.formSnapshot as unknown as RoundSnapshot | null;
  const weights = weightsOf(round.perspectiveWeights);

  const participants = await prisma.appraisalParticipant.findMany({
    where: { roundId },
    select: { id: true, formId: true, resultStatus: true, assignments: { where: { status: "SUBMITTED" }, select: { raterType: true, answers: true } } },
  });
  let calculated = 0;
  let noAnswers = 0;
  let kept = 0;
  for (const p of participants) {
    if (p.resultStatus === "APPROVED" || p.resultStatus === "PUBLISHED" || p.resultStatus === "ACKNOWLEDGED") {
      kept++;
      continue;
    }
    const form = pickForm(snapshot, p.formId);
    const result = form
      ? computeResult({
          questions: form.questions,
          ratingMax: form.ratingMax,
          raters: p.assignments.map((a) => ({ raterType: a.raterType, answers: Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : [] })),
          perspectiveWeights: weights,
          mode: settings.calcMode,
          bands: settings.bands,
        })
      : null;
    if (!result) {
      noAnswers++;
      await prisma.appraisalParticipant.update({
        where: { id: p.id },
        data: { resultStatus: "NOT_CALCULATED", scorePercent: null, overallScore: null, grade: null, scoreBreakdown: undefined, calculatedAt: null },
      });
      continue;
    }
    await prisma.appraisalParticipant.update({
      where: { id: p.id },
      data: {
        resultStatus: "CALCULATED",
        scorePercent: result.scorePercent,
        overallScore: result.overallScore,
        grade: result.grade,
        scoreBreakdown: result as unknown as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      },
    });
    calculated++;
  }
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.calculate",
    entity: "AppraisalRound",
    entityId: roundId,
    after: { calculated, noAnswers, kept, mode: settings.calcMode },
    ...meta,
  });
  return { calculated, noAnswers, kept };
}

/* ───────────────────────── approve / publish ───────────────────────── */

const idsOrAll = (ids: readonly string[] | undefined) => (ids && ids.length ? { id: { in: [...ids] } } : {});

/** CALCULATED -> APPROVED for the chosen people (all calculated ones when none are chosen). Only when the company asks for approval. */
export async function approveResults(companyId: string, session: AccessClaims, roundId: string, participantIds?: string[], meta?: Meta) {
  const settings = await getSettings(companyId);
  if (settings.approvalLevels < 1) throw BadRequest("บริษัทยังไม่ได้ตั้งให้ต้องอนุมัติผล ประกาศผลได้เลย");
  const res = await prisma.appraisalParticipant.updateMany({
    where: { roundId, round: { companyId, deletedAt: null }, resultStatus: "CALCULATED", ...idsOrAll(participantIds) },
    data: { resultStatus: "APPROVED", approvedAt: new Date(), approvedById: session.sub },
  });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_result.approve", entity: "AppraisalRound", entityId: roundId, after: { count: res.count }, ...meta });
  return { approved: res.count };
}

/**
 * Publishes results of a closed round. With approval required only approved results can be published, otherwise
 * calculated ones. When the company lets people see their results, each person is told once in the app (and on LINE if linked).
 */
export async function publishResults(companyId: string, session: AccessClaims, roundId: string, participantIds?: string[], meta?: Meta) {
  const round = await prisma.appraisalRound.findFirst({ where: { id: roundId, companyId, deletedAt: null }, select: { name: true, status: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  if (round.status !== "CLOSED") throw BadRequest("ประกาศผลได้เมื่อปิดรอบแล้ว");
  const settings = await getSettings(companyId);
  const from = settings.approvalLevels >= 1 ? "APPROVED" : "CALCULATED";

  const rows = await prisma.appraisalParticipant.findMany({
    where: { roundId, resultStatus: from, ...idsOrAll(participantIds) },
    select: { id: true, employeeId: true },
  });
  if (rows.length === 0) throw BadRequest(from === "APPROVED" ? "ยังไม่มีผลที่อนุมัติแล้ว" : "ยังไม่มีผลที่คำนวณแล้ว");
  await prisma.appraisalParticipant.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { resultStatus: "PUBLISHED", publishedAt: new Date() } });

  let notified = 0;
  if (settings.employeeSees === "AFTER_PUBLISH") {
    for (const r of rows) {
      try {
        await createNotification(companyId, r.employeeId, {
          title: `ผลประเมิน: ${round.name}`,
          body: settings.ackRequired ? "ผลประเมินของคุณประกาศแล้ว กรุณาเปิดดูและกดรับทราบ" : "ผลประเมินของคุณประกาศแล้ว",
          category: "evaluation",
          link: "/appraisal/my-results",
        }, session.sub);
        notified++;
      } catch {
        /* one failed message must not stop the rest */
      }
    }
  }
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_result.publish", entity: "AppraisalRound", entityId: roundId, after: { published: rows.length, notified }, ...meta });
  return { published: rows.length, notified };
}

/* ───────────────────────── HR table ───────────────────────── */

export async function getRoundResults(companyId: string, roundId: string) {
  const round = await prisma.appraisalRound.findFirst({ where: { id: roundId, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const rows = await prisma.appraisalParticipant.findMany({
    where: { roundId },
    select: {
      id: true,
      departmentName: true,
      resultStatus: true,
      scorePercent: true,
      overallScore: true,
      grade: true,
      employee: { select: { firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: { employee: { employeeCode: "asc" } },
    take: 2000,
  });
  return rows.map((r) => ({
    participantId: r.id,
    name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
    code: r.employee.employeeCode,
    department: r.departmentName ?? "ไม่ระบุแผนก",
    status: r.resultStatus,
    scorePercent: r.scorePercent,
    overallScore: r.overallScore,
    grade: r.grade,
  }));
}

/* ───────────────────────── the employee's own results ───────────────────────── */

export interface MyResult {
  participantId: string;
  roundName: string;
  publishedAt: string | null;
  status: "PUBLISHED" | "ACKNOWLEDGED";
  scorePercent: number | null;
  overallScore: number | null;
  ratingMax: number;
  grade: string | null;
  needsAck: boolean;
  ackDays: number | null;
  types: { raterType: string; raters: number; percent: number }[];
  comments: { raterType: string; texts: string[] }[];
  hiddenGroups: string[];
}

/** Published results of the signed-in person, only when the company lets people see them. Small peer/subordinate groups stay hidden. */
export async function listMyResults(companyId: string, session: AccessClaims): Promise<MyResult[]> {
  if (!session.employeeId) throw Forbidden("บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  const settings = await getSettings(companyId);
  if (settings.employeeSees !== "AFTER_PUBLISH") return [];

  const rows = await prisma.appraisalParticipant.findMany({
    where: { employeeId: session.employeeId, resultStatus: { in: ["PUBLISHED", "ACKNOWLEDGED"] }, round: { companyId, deletedAt: null } },
    select: {
      id: true,
      formId: true,
      resultStatus: true,
      publishedAt: true,
      scorePercent: true,
      overallScore: true,
      grade: true,
      scoreBreakdown: true,
      round: { select: { name: true, formSnapshot: true } },
      assignments: { where: { status: "SUBMITTED" }, select: { raterType: true, answers: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return rows.map((p) => {
    const form = pickForm(p.round.formSnapshot as unknown as RoundSnapshot | null, p.formId);
    const breakdown = p.scoreBreakdown as unknown as PersonResult | null;
    const types = (breakdown?.types ?? []).filter((t) => NAMED_TYPES.has(t.raterType) || t.raters >= ANON_MIN);
    const hiddenGroups = (breakdown?.types ?? []).filter((t) => !NAMED_TYPES.has(t.raterType) && t.raters < ANON_MIN).map((t) => t.raterType);

    const byType = new Map<string, Answer[][]>();
    for (const a of p.assignments) byType.set(a.raterType, [...(byType.get(a.raterType) ?? []), Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : []]);
    const comments = [...byType.entries()]
      .filter(([t, sets]) => NAMED_TYPES.has(t) || sets.length >= ANON_MIN)
      .map(([raterType, sets]) => ({
        raterType,
        texts: summarizeAnswers((form?.questions ?? []) as SnapQuestion[], raterType, sets).flatMap((s) => s.texts),
      }))
      .filter((c) => c.texts.length > 0);

    return {
      participantId: p.id,
      roundName: p.round.name,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      status: p.resultStatus as "PUBLISHED" | "ACKNOWLEDGED",
      scorePercent: p.scorePercent,
      overallScore: p.overallScore,
      ratingMax: form?.ratingMax ?? 5,
      grade: p.grade,
      needsAck: settings.ackRequired && p.resultStatus === "PUBLISHED",
      ackDays: settings.ackDays,
      types: types.map((t) => ({ raterType: t.raterType, raters: t.raters, percent: t.percent })),
      comments,
      hiddenGroups,
    };
  });
}

export async function acknowledgeMyResult(companyId: string, session: AccessClaims, participantId: string, meta?: Meta) {
  if (!session.employeeId) throw Forbidden("บัญชีนี้ไม่ได้ผูกกับพนักงาน");
  const settings = await getSettings(companyId);
  if (!settings.ackRequired) throw BadRequest("ไม่ต้องกดรับทราบผล");
  const p = await prisma.appraisalParticipant.findFirst({
    where: { id: participantId, employeeId: session.employeeId, round: { companyId, deletedAt: null } },
    select: { id: true, resultStatus: true },
  });
  if (!p) throw NotFound("ไม่พบผลประเมิน");
  if (p.resultStatus !== "PUBLISHED") throw BadRequest("ผลนี้ยังไม่ประกาศหรือรับทราบแล้ว");
  await prisma.appraisalParticipant.update({ where: { id: p.id }, data: { resultStatus: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_result.acknowledge", entity: "AppraisalParticipant", entityId: p.id, ...meta });
  return { id: p.id };
}

/* ───────────────────────── HR fills in for a rater ───────────────────────── */

async function loadForHr(companyId: string, roundId: string, assignmentId: string) {
  const a = await prisma.appraisalAssignment.findFirst({
    where: { id: assignmentId, participant: { roundId, round: { companyId, deletedAt: null } } },
    select: {
      id: true,
      raterType: true,
      status: true,
      answers: true,
      rater: { select: { firstName: true, lastName: true } },
      participant: {
        select: {
          formId: true,
          employee: { select: { firstName: true, lastName: true, employeeCode: true } },
          round: { select: { name: true, status: true, endDate: true, formSnapshot: true } },
        },
      },
    },
  });
  if (!a) throw NotFound("ไม่พบงานประเมินนี้");
  const form = pickForm(a.participant.round.formSnapshot as unknown as RoundSnapshot | null, a.participant.formId);
  if (!form) throw BadRequest("รอบนี้ยังไม่พร้อม");
  return { a, form };
}

export async function getAssignmentForHr(companyId: string, roundId: string, assignmentId: string) {
  const { a, form } = await loadForHr(companyId, roundId, assignmentId);
  return {
    id: a.id,
    raterType: a.raterType,
    status: a.status,
    personName: `${a.participant.employee.firstName} ${a.participant.employee.lastName}`.trim(),
    personCode: a.participant.employee.employeeCode,
    roundName: a.participant.round.name,
    roundStatus: a.participant.round.status,
    endIso: a.participant.round.endDate ? a.participant.round.endDate.toISOString().slice(0, 10) : null,
    ratingMax: form.ratingMax,
    questions: visibleQuestions(form.questions as SnapQuestion[], a.raterType),
    answers: (Array.isArray(a.answers) ? a.answers : []) as unknown as Answer[],
    raterName: `${a.rater.firstName} ${a.rater.lastName}`.trim(),
  };
}

/** HR saves or submits answers for a rater (same checks as the rater's own screen); the audit log records who did it. */
export async function saveAssignmentAsHr(
  companyId: string,
  session: AccessClaims,
  roundId: string,
  assignmentId: string,
  input: { answers: { questionId: string; value: unknown }[]; submit: boolean },
  meta?: Meta,
) {
  const { a, form } = await loadForHr(companyId, roundId, assignmentId);
  if (a.participant.round.status !== "OPEN") throw BadRequest("รอบนี้ปิดแล้ว");
  if (a.status === "SUBMITTED") throw BadRequest("ส่งผลประเมินแล้ว แก้ไขไม่ได้");
  const answers = cleanAnswers(form.questions as SnapQuestion[], a.raterType, input.answers, form.ratingMax);
  if (input.submit) {
    const missing = unansweredRequired(form.questions as SnapQuestion[], a.raterType, answers);
    if (missing.length) throw BadRequest(`ยังตอบไม่ครบ: ${missing.join(", ")}`);
  }
  await prisma.appraisalAssignment.update({
    where: { id: assignmentId },
    data: {
      answers: answers as unknown as Prisma.InputJsonValue,
      status: input.submit ? "SUBMITTED" : "IN_PROGRESS",
      startedAt: a.status === "PENDING" ? new Date() : undefined,
      submittedAt: input.submit ? new Date() : null,
      submittedByUserId: input.submit ? session.sub : null,
    },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: input.submit ? "appraisal_assignment.submit_on_behalf" : "appraisal_assignment.save_on_behalf",
    entity: "AppraisalAssignment",
    entityId: assignmentId,
    ...meta,
  });
  return { id: assignmentId, status: input.submit ? "SUBMITTED" : "IN_PROGRESS", answered: answers.length };
}
