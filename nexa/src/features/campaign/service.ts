import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { scoreBand } from "@/lib/scoring";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  AddParticipantsInput,
  CampaignCreateInput,
  CampaignListQuery,
  CampaignUpdateInput,
  SubmitResponseInput,
} from "./schema";
import type { RaterType } from "./types";

type Meta = { ip?: string; userAgent?: string };

const competencySelect = {
  competencyId: true,
  weight: true,
  competency: { select: { name: true, description: true } },
} satisfies Prisma.EvaluationCampaignCompetencySelect;

const participantSelect = {
  id: true,
  overallScore: true,
  band: true,
  finalizedAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true, managerId: true },
  },
  responses: { select: { raterType: true, status: true, submittedAt: true } },
} satisfies Prisma.EvaluationParticipantSelect;

/**
 * Wildcard grants like "campaign:*" are expanded into concrete permission
 * keys at seed time (see `expandPermissions`), so `session.perms` never
 * literally contains "campaign:*" — checking the real, HR-exclusive
 * `campaign:approve` (Manager/Employee don't have it) is what actually works.
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("campaign:approve");
}

function mapCompetencies(rows: { competencyId: string; weight: number; competency: { name: string; description: string | null } }[]) {
  return rows.map((r) => ({
    competencyId: r.competencyId,
    name: r.competency.name,
    description: r.competency.description,
    weight: r.weight,
  }));
}

export async function listCampaigns(companyId: string, query: CampaignListQuery) {
  const campaigns = await prisma.evaluationCampaign.findMany({
    where: { companyId, deletedAt: null, ...(query.status ? { status: query.status } : {}) },
    select: {
      id: true,
      name: true,
      cycle: true,
      startDate: true,
      endDate: true,
      status: true,
      aiGenerated: true,
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    cycle: c.cycle,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    aiGenerated: c.aiGenerated,
    participantCount: c._count.participants,
  }));
}

export async function getCampaign(companyId: string, id: string, session: AccessClaims) {
  const campaign = await prisma.evaluationCampaign.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      cycle: true,
      startDate: true,
      endDate: true,
      status: true,
      aiGenerated: true,
      aiRationale: true,
      competencies: { select: competencySelect },
      participants: { select: participantSelect },
    },
  });
  if (!campaign) throw NotFound("ไม่พบแคมเปญ");

  const hrLevel = isHrLevel(session);
  const participants = hrLevel
    ? campaign.participants
    : campaign.participants.filter(
        (p) => p.employee.id === session.employeeId || p.employee.managerId === session.employeeId,
      );

  return {
    id: campaign.id,
    name: campaign.name,
    cycle: campaign.cycle,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    aiGenerated: campaign.aiGenerated,
    aiRationale: campaign.aiRationale,
    competencies: mapCompetencies(campaign.competencies),
    participants,
    participantCount: campaign.participants.length,
  };
}

export async function createCampaign(
  companyId: string,
  session: AccessClaims,
  input: CampaignCreateInput,
  meta?: Meta,
) {
  const competencyIds = input.competencies.map((c) => c.competencyId);
  const found = await prisma.competency.count({
    where: { id: { in: competencyIds }, companyId, deletedAt: null },
  });
  if (found !== competencyIds.length) throw BadRequest("พบสมรรถนะที่ไม่ถูกต้อง");

  const campaign = await prisma.evaluationCampaign.create({
    data: {
      companyId,
      name: input.name,
      cycle: input.cycle,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      aiGenerated: input.aiGenerated ?? false,
      aiRationale: input.aiRationale,
      createdById: session.sub,
      updatedById: session.sub,
      competencies: {
        create: input.competencies.map((c) => ({ competencyId: c.competencyId, weight: c.weight })),
      },
    },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.create",
    entity: "EvaluationCampaign",
    entityId: campaign.id,
    after: { name: input.name, cycle: input.cycle },
    ...meta,
  });

  return { id: campaign.id };
}

export async function updateCampaign(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: CampaignUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.evaluationCampaign.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!existing) throw NotFound("ไม่พบแคมเปญ");

  const changingCompetencies = input.competencies !== undefined;
  if (changingCompetencies && existing.status !== "DRAFT") {
    throw BadRequest("แก้ไขชุดสมรรถนะได้เฉพาะแคมเปญที่ยังเป็นฉบับร่าง");
  }

  if (changingCompetencies) {
    const competencyIds = input.competencies!.map((c) => c.competencyId);
    const found = await prisma.competency.count({
      where: { id: { in: competencyIds }, companyId, deletedAt: null },
    });
    if (found !== competencyIds.length) throw BadRequest("พบสมรรถนะที่ไม่ถูกต้อง");
  }

  await prisma.$transaction(async (tx) => {
    await tx.evaluationCampaign.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.cycle !== undefined ? { cycle: input.cycle } : {}),
        ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedById: session.sub,
      },
    });

    if (changingCompetencies) {
      await tx.evaluationCampaignCompetency.deleteMany({ where: { campaignId: id } });
      await tx.evaluationCampaignCompetency.createMany({
        data: input.competencies!.map((c) => ({ campaignId: id, competencyId: c.competencyId, weight: c.weight })),
      });
    }
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.update",
    entity: "EvaluationCampaign",
    entityId: id,
    ...meta,
  });

  return { id };
}

export async function deleteCampaign(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const existing = await prisma.evaluationCampaign.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (!existing) throw NotFound("ไม่พบแคมเปญ");
  if (existing.status !== "DRAFT") throw BadRequest("ลบได้เฉพาะแคมเปญที่ยังเป็นฉบับร่าง");

  await prisma.evaluationCampaign.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.delete",
    entity: "EvaluationCampaign",
    entityId: id,
    before: { name: existing.name },
    ...meta,
  });
}

/** Adds participants + seeds a SELF response for everyone and a MANAGER response for those who have a manager. */
export async function addParticipants(
  companyId: string,
  session: AccessClaims,
  campaignId: string,
  input: AddParticipantsInput,
  meta?: Meta,
) {
  const campaign = await prisma.evaluationCampaign.findFirst({
    where: { id: campaignId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!campaign) throw NotFound("ไม่พบแคมเปญ");

  const employees = await prisma.employee.findMany({
    where: { id: { in: input.employeeIds }, companyId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (employees.length === 0) throw BadRequest("ไม่พบพนักงานที่เลือก");

  const created: string[] = [];
  for (const emp of employees) {
    const participant = await prisma.evaluationParticipant.upsert({
      where: { campaignId_employeeId: { campaignId, employeeId: emp.id } },
      update: {},
      create: { campaignId, employeeId: emp.id },
      select: { id: true },
    });
    created.push(participant.id);

    await prisma.evaluationResponse.upsert({
      where: { participantId_raterType: { participantId: participant.id, raterType: "SELF" } },
      update: {},
      create: { participantId: participant.id, raterType: "SELF", raterEmployeeId: emp.id, scores: [] },
    });

    if (emp.managerId) {
      await prisma.evaluationResponse.upsert({
        where: { participantId_raterType: { participantId: participant.id, raterType: "MANAGER" } },
        update: {},
        create: { participantId: participant.id, raterType: "MANAGER", raterEmployeeId: emp.managerId, scores: [] },
      });
    }
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.add_participants",
    entity: "EvaluationCampaign",
    entityId: campaignId,
    after: { count: employees.length },
    ...meta,
  });

  return { participantIds: created };
}

export async function getParticipant(companyId: string, participantId: string, session: AccessClaims) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: {
      ...participantSelect,
      campaign: {
        select: { id: true, name: true, cycle: true, competencies: { select: competencySelect } },
      },
      responses: {
        select: {
          raterType: true,
          raterEmployeeId: true,
          status: true,
          scores: true,
          strengths: true,
          improvements: true,
          summary: true,
          submittedAt: true,
        },
      },
    },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");

  const hrLevel = isHrLevel(session);
  const own = participant.employee.id === session.employeeId;
  const managesTarget = participant.employee.managerId === session.employeeId;
  if (!hrLevel && !own && !managesTarget) {
    throw Forbidden("ไม่มีสิทธิ์ดูข้อมูลนี้");
  }

  return {
    id: participant.id,
    overallScore: participant.overallScore,
    band: participant.band,
    finalizedAt: participant.finalizedAt,
    employee: participant.employee,
    campaign: {
      id: participant.campaign.id,
      name: participant.campaign.name,
      cycle: participant.campaign.cycle,
      competencies: mapCompetencies(participant.campaign.competencies),
    },
    fullResponses: participant.responses,
  };
}

async function computeAndStoreScore(participantId: string) {
  const participant = await prisma.evaluationParticipant.findUnique({
    where: { id: participantId },
    select: {
      campaign: { select: { competencies: { select: { competencyId: true, weight: true } } } },
      responses: {
        where: { raterType: "MANAGER", status: "SUBMITTED" },
        select: { scores: true },
      },
    },
  });
  if (!participant || participant.responses.length === 0) return;

  const managerScores = participant.responses[0].scores as { competencyId: string; score: number }[];
  const weightMap = new Map(participant.campaign.competencies.map((c) => [c.competencyId, c.weight]));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of managerScores) {
    const weight = weightMap.get(s.competencyId) ?? 1;
    weightedSum += s.score * weight;
    totalWeight += weight;
  }
  const overall = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;

  await prisma.evaluationParticipant.update({
    where: { id: participantId },
    data: { overallScore: overall, band: scoreBand(overall) },
  });
}

/**
 * The rater type is derived from the caller's identity relative to the
 * participant — never trusted from the client — so an employee can't claim
 * to be submitting "as manager" (or vice versa).
 */
export async function submitMyResponse(
  companyId: string,
  session: AccessClaims,
  participantId: string,
  input: SubmitResponseInput,
  meta?: Meta,
) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: { id: true, employeeId: true, employee: { select: { managerId: true } } },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");

  let raterType: RaterType;
  if (session.employeeId === participant.employeeId) {
    raterType = "SELF";
  } else if (session.employeeId === participant.employee.managerId || isHrLevel(session)) {
    raterType = "MANAGER";
  } else {
    throw Forbidden("ไม่มีสิทธิ์ทำแบบประเมินนี้");
  }

  const response = await prisma.evaluationResponse.findUnique({
    where: { participantId_raterType: { participantId, raterType } },
    select: { id: true },
  });
  if (!response) throw NotFound("ไม่พบแบบประเมินของผู้ประเมินนี้");

  await prisma.evaluationResponse.update({
    where: { id: response.id },
    data: {
      scores: input.scores,
      strengths: input.strengths,
      improvements: input.improvements,
      summary: input.summary,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  if (raterType === "MANAGER") {
    await computeAndStoreScore(participantId);
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.submit_response",
    entity: "EvaluationParticipant",
    entityId: participantId,
    after: { raterType },
    ...meta,
  });

  return { ok: true as const, raterType };
}

export async function finalizeParticipant(
  companyId: string,
  session: AccessClaims,
  participantId: string,
  meta?: Meta,
) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: { id: true, overallScore: true },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");
  if (participant.overallScore === null) {
    throw BadRequest("ยังไม่มีคะแนนจากหัวหน้างาน ไม่สามารถสรุปผลได้");
  }

  await prisma.evaluationParticipant.update({
    where: { id: participantId },
    data: { finalizedAt: new Date() },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.finalize_participant",
    entity: "EvaluationParticipant",
    entityId: participantId,
    ...meta,
  });

  return { ok: true as const };
}
