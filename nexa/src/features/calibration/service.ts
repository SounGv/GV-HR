import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { scoreBand } from "@/lib/scoring";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { CalibrationParticipantUpdateInput, CalibrationSessionCreateInput, NineBoxQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

/**
 * Wildcard grants like "calibration:*" are expanded into concrete permission
 * keys at seed time, so `session.perms` never literally contains
 * "calibration:*" — checking the real, HR-exclusive "calibration:approve" is
 * what actually distinguishes HR from a Manager (who only holds `:read`).
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("calibration:approve");
}

const sessionParticipantSelect = {
  id: true,
  overallScore: true,
  band: true,
  finalizedAt: true,
  calibratedScore: true,
  calibratedBand: true,
  potential: true,
  potentialNote: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true, managerId: true },
  },
} satisfies Prisma.EvaluationParticipantSelect;

export async function listSessions(companyId: string) {
  const rows = await prisma.calibrationSession.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      status: true,
      completedAt: true,
      createdAt: true,
      campaign: { select: { id: true, name: true, cycle: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    campaign: r.campaign,
    participantCount: r._count.participants,
  }));
}

export async function getCalibrationSession(companyId: string, id: string, session: AccessClaims) {
  const row = await prisma.calibrationSession.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      completedAt: true,
      campaign: { select: { id: true, name: true, cycle: true } },
      participants: { select: sessionParticipantSelect },
    },
  });
  if (!row) throw NotFound("ไม่พบรอบปรับเทียบ");

  const hrLevel = isHrLevel(session);
  const participants = hrLevel
    ? row.participants
    : row.participants.filter((p) => p.employee.managerId === session.employeeId);

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notes: row.notes,
    completedAt: row.completedAt,
    campaign: row.campaign,
    participants,
  };
}

export async function createSession(
  companyId: string,
  session: AccessClaims,
  input: CalibrationSessionCreateInput,
  meta?: Meta,
) {
  const campaign = await prisma.evaluationCampaign.findFirst({
    where: { id: input.campaignId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!campaign) throw NotFound("ไม่พบแคมเปญ");

  const created = await prisma.$transaction(async (tx) => {
    const calibrationSession = await tx.calibrationSession.create({
      data: {
        companyId,
        campaignId: input.campaignId,
        name: input.name,
        facilitatorEmployeeId: session.employeeId ?? null,
      },
      select: { id: true },
    });

    const finalized = await tx.evaluationParticipant.findMany({
      where: { campaignId: input.campaignId, finalizedAt: { not: null } },
      select: { id: true, overallScore: true, band: true },
    });
    if (finalized.length === 0) {
      throw BadRequest("แคมเปญนี้ยังไม่มีผู้เข้าร่วมที่สรุปผลแล้ว");
    }

    for (const p of finalized) {
      await tx.evaluationParticipant.update({
        where: { id: p.id },
        data: {
          calibrationSessionId: calibrationSession.id,
          calibratedScore: p.overallScore,
          calibratedBand: p.band,
        },
      });
    }

    return calibrationSession;
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calibration.create_session",
    entity: "CalibrationSession",
    entityId: created.id,
    after: { name: input.name, campaignId: input.campaignId },
    ...meta,
  });

  return { id: created.id };
}

export async function updateParticipantCalibration(
  companyId: string,
  session: AccessClaims,
  participantId: string,
  input: CalibrationParticipantUpdateInput,
  meta?: Meta,
) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: {
      id: true,
      calibratedBand: true,
      employee: { select: { managerId: true } },
      calibrationSession: { select: { status: true } },
    },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");

  const hrLevel = isHrLevel(session);
  const managesTarget = participant.employee.managerId === session.employeeId;
  if (!hrLevel && !managesTarget) {
    throw Forbidden("ปรับเทียบได้เฉพาะทีมที่คุณดูแล");
  }
  if (participant.calibrationSession?.status === "COMPLETED") {
    throw BadRequest("รอบปรับเทียบนี้เสร็จสิ้นแล้ว");
  }

  const calibratedBand =
    input.calibratedBand ?? (input.calibratedScore !== undefined ? scoreBand(input.calibratedScore) : undefined);

  await prisma.evaluationParticipant.update({
    where: { id: participantId },
    data: {
      ...(input.calibratedScore !== undefined ? { calibratedScore: input.calibratedScore } : {}),
      ...(calibratedBand !== undefined ? { calibratedBand } : {}),
      ...(input.potential !== undefined ? { potential: input.potential } : {}),
      ...(input.potentialNote !== undefined ? { potentialNote: input.potentialNote } : {}),
    },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calibration.update_participant",
    entity: "EvaluationParticipant",
    entityId: participantId,
    after: input,
    ...meta,
  });

  return { ok: true as const };
}

export async function completeSession(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.calibrationSession.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบรอบปรับเทียบ");
  if (existing.status === "COMPLETED") throw BadRequest("รอบปรับเทียบนี้เสร็จสิ้นแล้ว");

  await prisma.calibrationSession.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "calibration.complete_session",
    entity: "CalibrationSession",
    entityId: id,
    ...meta,
  });

  return { ok: true as const };
}

type PerfTier = "LOW" | "MEDIUM" | "HIGH";

function performanceTier(band: string | null): PerfTier {
  if (band === "ดีเยี่ยม" || band === "ดี") return "HIGH";
  if (band === "ปานกลาง") return "MEDIUM";
  return "LOW";
}

export async function getNineBoxGrid(companyId: string, session: AccessClaims, query: NineBoxQuery) {
  const hrLevel = isHrLevel(session);
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(hrLevel ? {} : { managerId: session.employeeId }),
    },
    select: { id: true },
  });
  const visibleIds = employees.map((e) => e.id);

  const cells: Record<PerfTier, Record<PerfTier, unknown[]>> = {
    HIGH: { LOW: [], MEDIUM: [], HIGH: [] },
    MEDIUM: { LOW: [], MEDIUM: [], HIGH: [] },
    LOW: { LOW: [], MEDIUM: [], HIGH: [] },
  };
  if (visibleIds.length === 0) return cells;

  const rows = await prisma.evaluationParticipant.findMany({
    where: {
      employeeId: { in: visibleIds },
      potential: { not: null },
      campaign: { companyId, deletedAt: null, ...(query.campaignId ? { id: query.campaignId } : {}) },
    },
    select: {
      employeeId: true,
      band: true,
      calibratedBand: true,
      potential: true,
      employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true } },
      campaign: { select: { startDate: true } },
    },
    orderBy: { campaign: { startDate: "desc" } },
  });

  const latestByEmployee = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByEmployee.has(row.employeeId)) latestByEmployee.set(row.employeeId, row);
  }

  for (const row of latestByEmployee.values()) {
    const perfTier = performanceTier(row.calibratedBand ?? row.band);
    const potentialTier = row.potential as PerfTier;
    cells[potentialTier][perfTier].push(row.employee);
  }

  return cells;
}
