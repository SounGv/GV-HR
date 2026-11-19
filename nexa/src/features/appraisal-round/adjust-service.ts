import { displayName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { getSettings } from "./results-service";
import { pickForm, type RoundSnapshot } from "./form-snapshot";
import { gradeFor } from "./scoring";
import { canAdjustStatus, checkAdjustment, checkRevert, roundPercent } from "./adjust-rules";

type Meta = { ip?: string; userAgent?: string };

/**
 * HR adjusts a calculated score by hand, or undoes an adjustment. The caller must hold `campaign:update` (HR only, the
 * owner's decision of 15 Nov 2026). Every change is written to the history with who, why, and the before and after, and
 * to the audit log. The score stored on the person becomes the adjusted one, so approval, publishing and
 * "ผลประเมินของฉัน" need no change; the history is never shown to the employee.
 */

async function load(companyId: string, roundId: string, participantId: string) {
  const row = await prisma.appraisalParticipant.findFirst({
    where: { id: participantId, roundId, round: { companyId, deletedAt: null } },
    select: {
      id: true,
      formId: true,
      resultStatus: true,
      scorePercent: true,
      grade: true,
      adjustedAt: true,
      originalScorePercent: true,
      originalGrade: true,
      round: { select: { formSnapshot: true } },
    },
  });
  if (!row) throw NotFound("ไม่พบผู้ถูกประเมินในรอบนี้");
  if (!canAdjustStatus(row.resultStatus) || row.scorePercent === null) {
    throw BadRequest("ปรับคะแนนได้เฉพาะผลที่คำนวณแล้วและยังไม่อนุมัติ");
  }
  return row as typeof row & { scorePercent: number };
}

/** Who to write in the history: the employee's name when the account has one, else the login name. */
async function whoIs(session: AccessClaims): Promise<string> {
  if (session.employeeId) {
    const e = await prisma.employee.findUnique({ where: { id: session.employeeId }, select: { firstName: true, lastName: true, nickname: true } });
    if (e) return displayName(e);
  }
  return session.username ?? session.email ?? "HR";
}

/** The score on the form's own scale, kept in step with the percentage (the calculation stores both). */
function overallFor(percent: number, row: { formId: string | null; round: { formSnapshot: unknown } }): number | undefined {
  const form = pickForm(row.round.formSnapshot as RoundSnapshot | null, row.formId);
  return form ? Math.round((percent / 100) * form.ratingMax * 100) / 100 : undefined;
}

export async function adjustScore(
  companyId: string,
  session: AccessClaims,
  roundId: string,
  participantId: string,
  input: { scorePercent: number; reason: string },
  meta?: Meta,
) {
  const row = await load(companyId, roundId, participantId);
  const original = row.originalScorePercent ?? row.scorePercent;
  const originalGrade = row.originalScorePercent !== null ? row.originalGrade : row.grade;
  const problem = checkAdjustment({ original, current: row.scorePercent, next: input.scorePercent, reason: input.reason });
  if (problem) throw BadRequest(problem);

  const next = roundPercent(input.scorePercent);
  const settings = await getSettings(companyId);
  const toGrade = gradeFor(next, settings.bands);
  const reason = input.reason.trim();
  const byName = await whoIs(session);
  const overall = overallFor(next, row);

  // The new score and its history go in together: a score with no recorded reason must never exist.
  await prisma.$transaction([
    prisma.appraisalParticipant.update({
      where: { id: row.id },
      data: {
        scorePercent: next,
        grade: toGrade,
        ...(overall !== undefined ? { overallScore: overall } : {}),
        adjustedAt: new Date(),
        originalScorePercent: original,
        originalGrade: originalGrade ?? null,
      },
    }),
    prisma.appraisalScoreAdjustment.create({
      data: { participantId: row.id, kind: "ADJUST", fromPercent: row.scorePercent, toPercent: next, fromGrade: row.grade, toGrade, reason, byUserId: session.sub, byName },
    }),
  ]);
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_result.adjust",
    entity: "AppraisalParticipant",
    entityId: row.id,
    before: { scorePercent: row.scorePercent, grade: row.grade },
    after: { scorePercent: next, grade: toGrade, originalScorePercent: original, reason },
    ...meta,
  });
  return { scorePercent: next, grade: toGrade };
}

export async function revertAdjustment(
  companyId: string,
  session: AccessClaims,
  roundId: string,
  participantId: string,
  input: { reason: string },
  meta?: Meta,
) {
  const row = await load(companyId, roundId, participantId);
  if (!row.adjustedAt || row.originalScorePercent === null) throw BadRequest("คะแนนของคนนี้ยังไม่ได้ถูกปรับ");
  const problem = checkRevert(input.reason);
  if (problem) throw BadRequest(problem);

  const back = row.originalScorePercent;
  const settings = await getSettings(companyId);
  // Graded with today's bands, the same as a fresh calculation would be.
  const toGrade = gradeFor(back, settings.bands);
  const reason = input.reason.trim();
  const byName = await whoIs(session);
  const overall = overallFor(back, row);

  await prisma.$transaction([
    prisma.appraisalParticipant.update({
      where: { id: row.id },
      data: {
        scorePercent: back,
        grade: toGrade,
        ...(overall !== undefined ? { overallScore: overall } : {}),
        adjustedAt: null,
        originalScorePercent: null,
        originalGrade: null,
      },
    }),
    prisma.appraisalScoreAdjustment.create({
      data: { participantId: row.id, kind: "REVERT", fromPercent: row.scorePercent, toPercent: back, fromGrade: row.grade, toGrade, reason, byUserId: session.sub, byName },
    }),
  ]);
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_result.adjust_revert",
    entity: "AppraisalParticipant",
    entityId: row.id,
    before: { scorePercent: row.scorePercent, grade: row.grade },
    after: { scorePercent: back, grade: toGrade, reason },
    ...meta,
  });
  return { scorePercent: back, grade: toGrade };
}
