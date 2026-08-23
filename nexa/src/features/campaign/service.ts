import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import { scoreBand } from "@/lib/scoring";
import { createNotification } from "@/features/notification/service";
import { getTemplateSnapshot, cloneTemplate, updateTemplate as updateEvaluationTemplate } from "@/features/evaluation-template/service";
import type { CampaignTemplateSnapshot } from "@/features/evaluation-template/types";
import { scoreTemplateAnswersDetailed, scoreCompetenciesDetailed, bandScoreStatus } from "./scoring";
import { RATER_LABEL } from "./labels";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  AddParticipantsInput,
  CampaignCreateInput,
  CampaignListQuery,
  CampaignUpdateInput,
  CloneCampaignInput,
  InviteRaterInput,
  RequestReopenInput,
  SaveDraftInput,
  SubmitResponseInput,
} from "./schema";
import type { RaterType } from "./types";

type Meta = { ip?: string; userAgent?: string };

const competencySelect = {
  competencyId: true,
  weight: true,
  competency: {
    select: {
      name: true,
      description: true,
      exampleBehavior: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EvaluationCampaignCompetencySelect;

const participantSelect = {
  id: true,
  overallScore: true,
  band: true,
  finalizedAt: true,
  scorePercent: true,
  scoreStatus: true,
  employeeAcknowledged: true,
  rawScore: true,
  maxScore: true,
  questionCount: true,
  evaluatorCount: true,
  lowestTopics: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true, managerId: true },
  },
  responses: { select: { raterType: true, status: true, submittedAt: true, raterEmployeeId: true, reopenRequested: true, dueDate: true } },
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

function mapCompetencies(
  rows: {
    competencyId: string;
    weight: number;
    competency: {
      name: string;
      description: string | null;
      exampleBehavior: string | null;
      categoryId: string | null;
      category: { id: string; name: string } | null;
    };
  }[],
) {
  return rows.map((r) => ({
    competencyId: r.competencyId,
    name: r.competency.name,
    description: r.competency.description,
    exampleBehavior: r.competency.exampleBehavior,
    categoryId: r.competency.categoryId,
    category: r.competency.category,
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
      raterTypes: true,
      aiGenerated: true,
      templateId: true,
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
    raterTypes: c.raterTypes,
    aiGenerated: c.aiGenerated,
    templateId: c.templateId,
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
      raterTypes: true,
      aiGenerated: true,
      aiRationale: true,
      templateId: true,
      templateSnapshot: true,
      competencies: { select: competencySelect },
      participants: { select: participantSelect },
    },
  });
  if (!campaign) throw NotFound("ไม่พบแคมเปญ");

  const hrLevel = isHrLevel(session);
  // Own record, direct reports (as their manager), or anyone the viewer was
  // specifically invited to rate (PEER/UPWARD — not derivable from the org
  // chart, since that's the whole point of those rater types) — see the
  // matching fix in getParticipant() below.
  const participants = hrLevel
    ? campaign.participants
    : campaign.participants.filter(
        (p) =>
          p.employee.id === session.employeeId ||
          p.employee.managerId === session.employeeId ||
          p.responses.some((r) => r.raterEmployeeId === session.employeeId),
      );

  return {
    id: campaign.id,
    name: campaign.name,
    cycle: campaign.cycle,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    raterTypes: campaign.raterTypes,
    aiGenerated: campaign.aiGenerated,
    aiRationale: campaign.aiRationale,
    templateId: campaign.templateId,
    templateSnapshot: campaign.templateSnapshot as unknown as CampaignTemplateSnapshot | null,
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
  // Template-based campaigns freeze a snapshot at create time and skip the
  // Competency list entirely — the two paths are mutually exclusive (see
  // campaignCreateSchema's refine).
  const templateSnapshot = input.templateId ? await getTemplateSnapshot(companyId, input.templateId) : null;

  if (!templateSnapshot) {
    const competencyIds = (input.competencies ?? []).map((c) => c.competencyId);
    const found = await prisma.competency.count({
      where: { id: { in: competencyIds }, companyId, deletedAt: null },
    });
    if (found !== competencyIds.length) throw BadRequest("พบสมรรถนะที่ไม่ถูกต้อง");
  }

  const campaign = await prisma.evaluationCampaign.create({
    data: {
      companyId,
      name: input.name,
      cycle: input.cycle,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      acknowledgeDueDate: input.acknowledgeDueDate ? new Date(input.acknowledgeDueDate) : undefined,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : undefined,
      clonedFromId: input.clonedFromId,
      raterTypes: input.raterTypes,
      aiGenerated: input.aiGenerated ?? false,
      aiRationale: input.aiRationale,
      createdById: session.sub,
      updatedById: session.sub,
      ...(templateSnapshot
        ? { templateId: templateSnapshot.templateId, templateSnapshot: templateSnapshot as object }
        : {
            competencies: {
              create: (input.competencies ?? []).map((c) => ({ competencyId: c.competencyId, weight: c.weight })),
            },
          }),
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

/**
 * "สร้างรอบใหม่จากรอบเดิม" — Q2/2569 -> Q3/2569. Never touches the source
 * campaign or its results: a template-based source gets its template cloned
 * to a fresh (auto-activated) DRAFT version first, so questions can be
 * tweaked for the new cycle without affecting the old one's frozen
 * templateSnapshot; a Competency-based source's weight list is copied as-is
 * (optionally filtered to a subset of categories). Participants default to
 * the source's own list unless the caller overrides it.
 */
export async function cloneCampaign(
  companyId: string,
  session: AccessClaims,
  sourceCampaignId: string,
  input: CloneCampaignInput,
  meta?: Meta,
) {
  const source = await prisma.evaluationCampaign.findFirst({
    where: { id: sourceCampaignId, companyId, deletedAt: null },
    select: {
      templateId: true,
      raterTypes: true,
      competencies: { select: { competencyId: true, weight: true, competency: { select: { categoryId: true } } } },
      participants: { select: { employeeId: true, employee: { select: { managerId: true } } } },
    },
  });
  if (!source) throw NotFound("ไม่พบแคมเปญต้นทาง");

  let templateId: string | undefined;
  let competencies: { competencyId: string; weight: number }[] | undefined;

  if (source.templateId) {
    const cloned = await cloneTemplate(companyId, session, source.templateId, meta);
    await updateEvaluationTemplate(companyId, session, cloned.id, { status: "ACTIVE" }, meta);
    templateId = cloned.id;
  } else {
    competencies = source.competencies
      .filter((c) => !input.categoryIds || input.categoryIds.length === 0 || (c.competency.categoryId && input.categoryIds.includes(c.competency.categoryId)))
      .map((c) => ({ competencyId: c.competencyId, weight: c.weight }));
  }

  const created = await createCampaign(
    companyId,
    session,
    {
      name: input.name,
      cycle: input.cycle,
      startDate: input.startDate,
      endDate: input.endDate,
      acknowledgeDueDate: input.acknowledgeDueDate,
      followUpDate: input.followUpDate,
      raterTypes: input.raterTypes ?? source.raterTypes,
      templateId,
      competencies,
      clonedFromId: sourceCampaignId,
    },
    meta,
  );

  const employees = input.employeeIds
    ? await prisma.employee.findMany({ where: { id: { in: input.employeeIds }, companyId, deletedAt: null }, select: { id: true, managerId: true } })
    : source.participants.map((p) => ({ id: p.employeeId, managerId: p.employee.managerId }));

  await seedParticipants(created.id, input.raterTypes ?? source.raterTypes, employees);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.clone",
    entity: "EvaluationCampaign",
    entityId: created.id,
    before: { clonedFromId: sourceCampaignId },
    after: { name: input.name, cycle: input.cycle },
    ...meta,
  });

  return { id: created.id };
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
        ...(input.acknowledgeDueDate !== undefined ? { acknowledgeDueDate: new Date(input.acknowledgeDueDate) } : {}),
        ...(input.followUpDate !== undefined ? { followUpDate: new Date(input.followUpDate) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.status === "ACTIVE" && existing.status !== "ACTIVE" ? { publishedAt: new Date() } : {}),
        ...(input.status === "CLOSED" && existing.status !== "CLOSED" ? { closedAt: new Date() } : {}),
        ...(input.raterTypes !== undefined ? { raterTypes: input.raterTypes } : {}),
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

  // Activating a campaign is the moment every already-seeded rater (added
  // while it was still DRAFT — the normal "set it up, then turn it on" flow)
  // first gets notified, since addParticipants() only notifies when the
  // campaign is already ACTIVE at that moment.
  if (input.status === "ACTIVE" && existing.status !== "ACTIVE") {
    const campaign = await prisma.evaluationCampaign.findUnique({ where: { id }, select: { name: true, cycle: true } });
    const pending = await prisma.evaluationResponse.findMany({
      where: { status: "PENDING", participant: { campaignId: id } },
      select: {
        raterType: true,
        raterEmployeeId: true,
        participant: { select: { id: true, employee: { select: { firstName: true, lastName: true } } } },
      },
    });
    const cycleLabel = `${campaign!.name} · ${campaign!.cycle}`;
    // Sequential, not Promise.all — a pooled connection (e.g. PgBouncer
    // transaction mode with a low connection_limit) can only serve one
    // query at a time, and firing dozens/hundreds of concurrent creates at
    // once exhausts the pool wait queue and throws P2024 well before they'd
    // all finish anyway.
    for (const r of pending) {
      await createNotification(
        companyId,
        r.raterEmployeeId,
        r.raterType === "SELF"
          ? {
              title: "มีแบบประเมินตนเองรอทำ",
              body: `รอบประเมิน ${cycleLabel} — กรุณาเข้าไปประเมินตนเอง`,
              category: "performance",
              link: `/performance/campaigns/${id}/participants/${r.participant.id}`,
            }
          : {
              title: r.raterType === "MANAGER" ? "มีพนักงานรอการประเมินจากคุณ" : "คุณได้รับเชิญให้ร่วมประเมิน",
              body: `${r.participant.employee.firstName} ${r.participant.employee.lastName} — รอบประเมิน ${cycleLabel}`,
              category: "performance",
              link: `/performance/campaigns/${id}/participants/${r.participant.id}`,
            },
        session.sub,
      );
    }
  }

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

/**
 * Adds participants and seeds one PENDING response per rater direction the
 * campaign actually collects (`campaign.raterTypes` — SELF, MANAGER, or
 * both). MANAGER is still skipped for anyone without a manager, same as
 * before this was configurable.
 */
/**
 * Upserts participants + their PENDING responses for the campaign's active
 * rater types. Shared by the HR-facing `addParticipants` (below) and the
 * cron-triggered schedule generator, which has no session/permission check
 * to gate — it's server-only system logic.
 */
export async function seedParticipants(
  campaignId: string,
  raterTypes: RaterType[],
  employees: { id: string; managerId: string | null }[],
) {
  // UPWARD is the one invite-based rater type that's actually fully derivable
  // from the org chart (a participant's own direct reports), unlike PEER/
  // HR_EXEC which need HR to pick a specific person — so it auto-seeds here
  // too, instead of requiring one manual invite per report.
  const directReportsByManager = new Map<string, { id: string }[]>();
  if (raterTypes.includes("UPWARD")) {
    const reports = await prisma.employee.findMany({
      where: { managerId: { in: employees.map((e) => e.id) }, deletedAt: null },
      select: { id: true, managerId: true },
    });
    for (const r of reports) {
      if (!r.managerId) continue;
      const list = directReportsByManager.get(r.managerId) ?? [];
      list.push({ id: r.id });
      directReportsByManager.set(r.managerId, list);
    }
  }

  const created: string[] = [];
  for (const emp of employees) {
    const participant = await prisma.evaluationParticipant.upsert({
      where: { campaignId_employeeId: { campaignId, employeeId: emp.id } },
      update: {},
      create: { campaignId, employeeId: emp.id },
      select: { id: true },
    });
    created.push(participant.id);

    if (raterTypes.includes("SELF")) {
      await prisma.evaluationResponse.upsert({
        where: {
          participantId_raterType_raterEmployeeId: { participantId: participant.id, raterType: "SELF", raterEmployeeId: emp.id },
        },
        update: {},
        create: { participantId: participant.id, raterType: "SELF", raterEmployeeId: emp.id, scores: [] },
      });
    }

    if (raterTypes.includes("MANAGER") && emp.managerId) {
      await prisma.evaluationResponse.upsert({
        where: {
          participantId_raterType_raterEmployeeId: {
            participantId: participant.id,
            raterType: "MANAGER",
            raterEmployeeId: emp.managerId,
          },
        },
        update: {},
        create: { participantId: participant.id, raterType: "MANAGER", raterEmployeeId: emp.managerId, scores: [] },
      });
    }

    for (const report of directReportsByManager.get(emp.id) ?? []) {
      await prisma.evaluationResponse.upsert({
        where: {
          participantId_raterType_raterEmployeeId: {
            participantId: participant.id,
            raterType: "UPWARD",
            raterEmployeeId: report.id,
          },
        },
        update: {},
        create: { participantId: participant.id, raterType: "UPWARD", raterEmployeeId: report.id, scores: [] },
      });
    }
  }
  return created;
}

export async function addParticipants(
  companyId: string,
  session: AccessClaims,
  campaignId: string,
  input: AddParticipantsInput,
  meta?: Meta,
) {
  const campaign = await prisma.evaluationCampaign.findFirst({
    where: { id: campaignId, companyId, deletedAt: null },
    select: { id: true, name: true, cycle: true, status: true, raterTypes: true },
  });
  if (!campaign) throw NotFound("ไม่พบแคมเปญ");

  const employees = await prisma.employee.findMany({
    where: { id: { in: input.employeeIds }, companyId, deletedAt: null },
    select: { id: true, managerId: true, firstName: true, lastName: true },
  });
  if (employees.length === 0) throw BadRequest("ไม่พบพนักงานที่เลือก");

  const created = await seedParticipants(campaignId, campaign.raterTypes, employees);

  // Notify every rater who just got a task seeded for them — otherwise the
  // only way to discover it is to happen to open the performance menu. Only
  // for ACTIVE campaigns: getMyPendingResponses only surfaces ACTIVE ones,
  // so notifying about a still-DRAFT campaign would point at a task the
  // rater can't yet find in their pending list.
  const cycleLabel = `${campaign.name} · ${campaign.cycle}`;
  // Sequential, not Promise.all — see the matching note in updateCampaign:
  // a pooled connection can only serve one query at a time, and firing many
  // concurrent creates at once exhausts the pool wait queue (P2024) instead
  // of just taking a bit longer.
  if (campaign.status === "ACTIVE") {
    for (const [i, emp] of employees.entries()) {
      const link = `/performance/campaigns/${campaignId}/participants/${created[i]}`;
      if (campaign.raterTypes.includes("SELF")) {
        await createNotification(
          companyId,
          emp.id,
          {
            title: "มีแบบประเมินตนเองรอทำ",
            body: `รอบประเมิน ${cycleLabel} — กรุณาเข้าไปประเมินตนเอง`,
            category: "performance",
            link,
          },
          session.sub,
        );
      }
      if (campaign.raterTypes.includes("MANAGER") && emp.managerId) {
        await createNotification(
          companyId,
          emp.managerId,
          {
            title: "มีพนักงานรอการประเมินจากคุณ",
            body: `${emp.firstName} ${emp.lastName} — รอบประเมิน ${cycleLabel}`,
            category: "performance",
            link,
          },
          session.sub,
        );
      }
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
        select: {
          id: true,
          name: true,
          cycle: true,
          raterTypes: true,
          competencies: { select: competencySelect },
          templateSnapshot: true,
        },
      },
      responses: {
        select: {
          id: true,
          raterType: true,
          raterEmployeeId: true,
          status: true,
          scores: true,
          answers: true,
          strengths: true,
          improvements: true,
          summary: true,
          evidenceUrls: true,
          submittedAt: true,
          reopenRequested: true,
          reopenRequestNote: true,
        },
      },
    },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");

  const hrLevel = isHrLevel(session);
  const own = participant.employee.id === session.employeeId;
  const managesTarget = participant.employee.managerId === session.employeeId;
  // PEER/UPWARD raters are invited individually and aren't derivable from the
  // org chart at all (an UPWARD rater is a direct report of the participant,
  // the reverse of managesTarget) — without this, every UPWARD/PEER rater
  // 404s trying to open the page they were notified to go score.
  const isInvitedRater = participant.responses.some((r) => r.raterEmployeeId === session.employeeId);
  if (!hrLevel && !own && !managesTarget && !isInvitedRater) {
    throw Forbidden("ไม่มีสิทธิ์ดูข้อมูลนี้");
  }

  return {
    id: participant.id,
    overallScore: participant.overallScore,
    band: participant.band,
    finalizedAt: participant.finalizedAt,
    scorePercent: participant.scorePercent,
    scoreStatus: participant.scoreStatus,
    employeeAcknowledged: participant.employeeAcknowledged,
    rawScore: participant.rawScore,
    maxScore: participant.maxScore,
    questionCount: participant.questionCount,
    evaluatorCount: participant.evaluatorCount,
    lowestTopics: participant.lowestTopics as unknown as { key: string; label: string; score: number; maxScore: number }[] | null,
    employee: participant.employee,
    campaign: {
      id: participant.campaign.id,
      name: participant.campaign.name,
      cycle: participant.campaign.cycle,
      raterTypes: participant.campaign.raterTypes,
      competencies: mapCompetencies(participant.campaign.competencies),
      templateSnapshot: participant.campaign.templateSnapshot as unknown as CampaignTemplateSnapshot | null,
    },
    fullResponses: await withRaterEmployees(participant.responses),
  };
}

/** Attaches each response's rater's name/photo — raterEmployeeId has no FK
 * (PEER/UPWARD raters aren't derivable from the org chart at all, so the
 * column is just a plain id), hence the separate lookup instead of a select. */
async function withRaterEmployees<T extends { raterEmployeeId: string; answers: unknown; evidenceUrls: unknown }>(
  responses: T[],
): Promise<
  (Omit<T, "answers" | "evidenceUrls"> & {
    answers: { questionId: string; value: string }[] | null;
    evidenceUrls: string[] | null;
    raterEmployee: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  })[]
> {
  const raterIds = [...new Set(responses.map((r) => r.raterEmployeeId))];
  const raters = await prisma.employee.findMany({
    where: { id: { in: raterIds } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const raterMap = new Map(raters.map((r) => [r.id, r]));
  return responses.map((r) => ({
    ...r,
    answers: r.answers as { questionId: string; value: string }[] | null,
    evidenceUrls: r.evidenceUrls as string[] | null,
    raterEmployee: raterMap.get(r.raterEmployeeId) ?? null,
  }));
}

/**
 * The "official" score comes from the MANAGER response when the campaign
 * collects one — that's unchanged. For a SELF-only round (no MANAGER in
 * `raterTypes`), the self-assessment becomes the official score instead, so
 * one-directional rounds still produce a score/band once their single rater
 * submits.
 */
/**
 * Recomputes and stores the full score breakdown (not just a final percent —
 * raw/max/weighted-percent/question count/evaluator count/lowest topics)
 * plus the HR-configurable band (scoreStatus). Runs every time the scoring
 * rater (re-)submits; does NOT trigger the low-score automation itself —
 * that only fires once at finalize time (see finalizeParticipant), since a
 * score can still change before HR/the manager actually finalizes it.
 */
async function computeAndStoreScore(companyId: string, participantId: string) {
  const participant = await prisma.evaluationParticipant.findUnique({
    where: { id: participantId },
    select: {
      campaign: {
        select: {
          raterTypes: true,
          competencies: { select: { competencyId: true, weight: true, competency: { select: { name: true, maxScore: true } } } },
          templateSnapshot: true,
        },
      },
      responses: { select: { raterType: true, status: true, scores: true, answers: true } },
    },
  });
  if (!participant) return;

  const scoringRaterType = participant.campaign.raterTypes.includes("MANAGER") ? "MANAGER" : "SELF";
  const response = participant.responses.find(
    (r) => r.raterType === scoringRaterType && r.status === "SUBMITTED",
  );
  if (!response) return;

  const templateSnapshot = participant.campaign.templateSnapshot as unknown as CampaignTemplateSnapshot | null;
  const breakdown = templateSnapshot
    ? scoreTemplateAnswersDetailed(templateSnapshot.sections, (response.answers as { questionId: string; value: string }[] | null) ?? [])
    : scoreCompetenciesDetailed(
        response.scores as { competencyId: string; score: number }[],
        new Map(
          participant.campaign.competencies.map((c) => [c.competencyId, { name: c.competency.name, weight: c.weight, maxScore: c.competency.maxScore }]),
        ),
      );

  const thresholds = await getEvaluationThresholds(companyId);
  const evaluatorCount = participant.responses.filter((r) => r.status === "SUBMITTED").length;
  // Legacy 1-5 band (scoreBand/band) kept alongside the new percent-based
  // scoreStatus — existing UI (9-Box, calibration, evaluation history) still
  // reads overallScore/band and shouldn't have to change to keep working.
  const legacyOverall = breakdown.maxScore > 0 ? Math.round((breakdown.rawScore / breakdown.maxScore) * 5 * 100) / 100 : 0;

  await prisma.evaluationParticipant.update({
    where: { id: participantId },
    data: {
      overallScore: legacyOverall,
      band: scoreBand(legacyOverall),
      rawScore: breakdown.rawScore,
      maxScore: breakdown.maxScore,
      scorePercent: breakdown.scorePercent,
      questionCount: breakdown.questionCount,
      evaluatorCount,
      lowestTopics: breakdown.lowestTopics as unknown as Prisma.InputJsonValue,
      scoreStatus: bandScoreStatus(breakdown.scorePercent, thresholds),
    },
  });
}

/**
 * Every evaluation task the caller still owes a score for, across every
 * active campaign — SELF (their own), MANAGER (their reports'), and any
 * PEER/UPWARD invites, since all four are just rows in the same table keyed
 * by `raterEmployeeId`. Powers both the mobile performance screen's
 * "รายการที่ต้องให้คะแนน" list and the Home tab's pending-count card.
 */
export async function getMyPendingResponses(companyId: string, session: AccessClaims) {
  const employeeId = session.employeeId;
  if (!employeeId) return [];

  const rows = await prisma.evaluationResponse.findMany({
    where: {
      raterEmployeeId: employeeId,
      status: "PENDING",
      participant: { campaign: { companyId, status: "ACTIVE", deletedAt: null } },
    },
    select: {
      id: true,
      raterType: true,
      participant: {
        select: {
          id: true,
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          campaign: {
            select: {
              id: true,
              name: true,
              cycle: true,
              startDate: true,
              endDate: true,
              templateSnapshot: true,
              _count: { select: { competencies: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return rows.map((r) => {
    const snapshot = r.participant.campaign.templateSnapshot as CampaignTemplateSnapshot | null;
    // Responses in this list are always PENDING (not yet submitted — there's
    // no draft-save), so only the total is meaningful here; per-question
    // answered progress is shown live on the answer form itself instead
    // (see TemplateProgress in participant-detail-view.tsx).
    const totalQuestions = snapshot
      ? snapshot.sections.reduce((n, s) => n + s.questions.length, 0)
      : r.participant.campaign._count.competencies;
    return {
      responseId: r.id,
      raterType: r.raterType,
      participantId: r.participant.id,
      campaignId: r.participant.campaign.id,
      campaignName: r.participant.campaign.name,
      cycle: r.participant.campaign.cycle,
      startDate: r.participant.campaign.startDate,
      endDate: r.participant.campaign.endDate,
      employee: r.participant.employee,
      totalQuestions,
    };
  });
}

/**
 * Every evaluation the caller has ever been asked to give a score for —
 * SELF/MANAGER/PEER/UPWARD/HR_EXEC alike, pending *and* already submitted,
 * across active and closed campaigns — so nothing drops out of view just
 * because it was finished or the campaign ended. `getMyPendingResponses`
 * above stays pending-only/active-only on purpose (it feeds the sidebar and
 * bottom-nav "still owe this" badge counts); this is the separate "my full
 * list, with history" view the task list/UI actually renders.
 */
export async function getMyEvaluationAssignments(companyId: string, session: AccessClaims) {
  const employeeId = session.employeeId;
  if (!employeeId) return [];

  const rows = await prisma.evaluationResponse.findMany({
    where: {
      raterEmployeeId: employeeId,
      participant: { campaign: { companyId, deletedAt: null } },
    },
    select: {
      id: true,
      raterType: true,
      status: true,
      submittedAt: true,
      participant: {
        select: {
          id: true,
          employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          campaign: {
            select: {
              id: true,
              name: true,
              cycle: true,
              startDate: true,
              endDate: true,
              templateSnapshot: true,
              _count: { select: { competencies: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Still-pending items first (they need action); submitted ones after,
  // most recently submitted first.
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
    return 0; // createdAt: "desc" from the query already orders each group
  });

  return sorted.map((r) => {
    const snapshot = r.participant.campaign.templateSnapshot as CampaignTemplateSnapshot | null;
    const totalQuestions = snapshot
      ? snapshot.sections.reduce((n, s) => n + s.questions.length, 0)
      : r.participant.campaign._count.competencies;
    return {
      responseId: r.id,
      raterType: r.raterType,
      status: r.status,
      submittedAt: r.submittedAt,
      participantId: r.participant.id,
      campaignId: r.participant.campaign.id,
      campaignName: r.participant.campaign.name,
      cycle: r.participant.campaign.cycle,
      startDate: r.participant.campaign.startDate,
      endDate: r.participant.campaign.endDate,
      employee: r.participant.employee,
      totalQuestions,
    };
  });
}

/**
 * Which response row belongs to the caller is derived from
 * `raterEmployeeId` — never trusted from the client. SELF/MANAGER rows are
 * stamped with the employee's/manager's id at seed time; PEER/UPWARD rows
 * are stamped with the specific invited rater's id at invite time
 * (see `invitePeerRater`) — so this single lookup works for all 4 rater
 * types without needing to re-derive the relationship here.
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
    select: { id: true, finalizedAt: true, campaign: { select: { status: true, templateSnapshot: true } } },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");
  if (participant.finalizedAt) {
    throw Forbidden("การประเมินนี้สรุปผลแล้ว ไม่สามารถแก้ไขคำตอบได้อีก");
  }
  if (participant.campaign.status === "CLOSED") {
    throw Forbidden("แคมเปญนี้ปิดแล้ว ไม่สามารถส่งแบบประเมินได้อีก");
  }

  const response = await prisma.evaluationResponse.findFirst({
    where: { participantId, raterEmployeeId: session.employeeId ?? "" },
    select: { id: true, raterType: true },
  });
  if (!response) throw Forbidden("ไม่มีสิทธิ์ทำแบบประเมินนี้");

  // Which field is actually stored is decided here, from the campaign's own
  // shape — never from whatever the client happened to send — so a stale
  // client or hand-rolled request can't silently score a template-based
  // campaign from an empty/irrelevant `scores` array (or vice versa).
  const templateSnapshot = participant.campaign.templateSnapshot as unknown as CampaignTemplateSnapshot | null;
  if (templateSnapshot) {
    // Only questions this rater type can actually see are required of them —
    // a question scoped to e.g. MANAGER must never block a PEER's submit.
    const requiredIds = templateSnapshot.sections.flatMap((s) =>
      s.questions
        .filter((q) => q.required && (q.visibleTo.length === 0 || q.visibleTo.includes(response.raterType)))
        .map((q) => q.id),
    );
    const answeredIds = new Set((input.answers ?? []).map((a) => a.questionId));
    if (requiredIds.some((id) => !answeredIds.has(id))) {
      throw BadRequest("กรุณาตอบคำถามที่บังคับตอบให้ครบทุกข้อ");
    }
  } else if (!input.scores || input.scores.length === 0) {
    throw BadRequest("กรุณาให้คะแนนสมรรถนะอย่างน้อย 1 รายการ");
  }

  await prisma.evaluationResponse.update({
    where: { id: response.id },
    data: {
      scores: templateSnapshot ? [] : input.scores,
      answers: templateSnapshot ? input.answers : undefined,
      strengths: input.strengths,
      improvements: input.improvements,
      summary: input.summary,
      evidenceUrls: input.evidenceUrls,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  // Idempotent w.r.t. which rater just submitted — it looks up the campaign's
  // configured scoring rater type itself (MANAGER if the round collects it,
  // else SELF) and only computes once that specific response exists.
  await computeAndStoreScore(companyId, participantId);

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.submit_response",
    entity: "EvaluationParticipant",
    entityId: participantId,
    after: { raterType: response.raterType },
    ...meta,
  });

  return { ok: true as const, raterType: response.raterType };
}

/** Autosave — writes whatever the rater has filled in so far without
 * requiring every required question to be answered yet, and without
 * touching the stored score (that only ever runs on actual submit). Keeps
 * status PENDING on the very first save, IN_PROGRESS after — so "resume"
 * (getParticipant) can tell a genuinely-untouched task apart from one the
 * rater already started. */
export async function saveDraftResponse(
  companyId: string,
  session: AccessClaims,
  participantId: string,
  input: SaveDraftInput,
) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: { finalizedAt: true, campaign: { select: { templateSnapshot: true, status: true } } },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");
  if (participant.finalizedAt) throw Forbidden("การประเมินนี้สรุปผลแล้ว ไม่สามารถแก้ไขคำตอบได้อีก");
  if (participant.campaign.status === "CLOSED") throw Forbidden("แคมเปญนี้ปิดแล้ว ไม่สามารถบันทึกแบบร่างได้");

  const response = await prisma.evaluationResponse.findFirst({
    where: { participantId, raterEmployeeId: session.employeeId ?? "" },
    select: { id: true, status: true },
  });
  if (!response) throw Forbidden("ไม่มีสิทธิ์ทำแบบประเมินนี้");
  if (response.status === "SUBMITTED") throw Forbidden("ส่งแบบประเมินนี้ไปแล้ว");

  const templateSnapshot = participant.campaign.templateSnapshot as unknown as CampaignTemplateSnapshot | null;
  await prisma.evaluationResponse.update({
    where: { id: response.id },
    data: {
      scores: templateSnapshot ? [] : (input.scores ?? []),
      answers: templateSnapshot ? input.answers : undefined,
      strengths: input.strengths,
      improvements: input.improvements,
      summary: input.summary,
      evidenceUrls: input.evidenceUrls,
      status: "IN_PROGRESS",
    },
  });

  return { ok: true as const };
}

/** Rater flags intent to change a SUBMITTED response — does not itself
 * reopen anything; only an HR/authorized approver acting on this flag can
 * (see approveReopen), and every step is audit-logged since a submitted
 * evaluation answer is the kind of thing "silently edited" would be bad. */
export async function requestReopen(
  companyId: string,
  session: AccessClaims,
  responseId: string,
  input: RequestReopenInput,
  meta?: Meta,
) {
  const response = await prisma.evaluationResponse.findFirst({
    where: { id: responseId, participant: { campaign: { companyId, deletedAt: null } } },
    select: { id: true, status: true, raterEmployeeId: true, participantId: true },
  });
  if (!response) throw NotFound("ไม่พบแบบประเมิน");
  if (response.raterEmployeeId !== session.employeeId) throw Forbidden("ขอแก้ไขได้เฉพาะแบบประเมินของตนเอง");
  if (response.status !== "SUBMITTED") throw BadRequest("ขอแก้ไขได้เฉพาะแบบประเมินที่ส่งไปแล้ว");

  await prisma.evaluationResponse.update({
    where: { id: responseId },
    data: { reopenRequested: true, reopenRequestedAt: new Date(), reopenRequestNote: input.note },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.request_reopen",
    entity: "EvaluationResponse",
    entityId: responseId,
    after: { note: input.note },
    ...meta,
  });

  return { ok: true as const };
}

/** HR-only (campaign:approve) — reverts a SUBMITTED response back to
 * PENDING so the rater can edit and resubmit. Never touches the stored
 * score directly; the next real submit recomputes it as usual. */
export async function approveReopen(
  companyId: string,
  session: AccessClaims,
  responseId: string,
  meta?: Meta,
) {
  const response = await prisma.evaluationResponse.findFirst({
    where: { id: responseId, participant: { campaign: { companyId, deletedAt: null } } },
    select: { id: true, status: true, reopenRequested: true, participant: { select: { finalizedAt: true } } },
  });
  if (!response) throw NotFound("ไม่พบแบบประเมิน");
  if (!isHrLevel(session)) throw Forbidden("เปิดแก้ไขใหม่ได้เฉพาะ HR");
  if (response.status !== "SUBMITTED") throw BadRequest("เปิดแก้ไขใหม่ได้เฉพาะแบบประเมินที่ส่งไปแล้ว");
  if (response.participant.finalizedAt) throw BadRequest("ผลการประเมินนี้สรุปผลแล้ว ไม่สามารถเปิดแก้ไขได้");

  await prisma.evaluationResponse.update({
    where: { id: responseId },
    data: {
      status: "PENDING",
      reopenRequested: false,
      reopenedAt: new Date(),
      reopenedById: session.sub,
    },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.approve_reopen",
    entity: "EvaluationResponse",
    entityId: responseId,
    ...meta,
  });

  return { ok: true as const };
}

/**
 * HR or the participant's own manager may invite a specific coworker as a
 * PEER rater, or one of the participant's direct reports as an UPWARD
 * rater — true 360 feedback is opt-in per participant, unlike SELF/MANAGER
 * which auto-seed for every campaign that collects them.
 */
export async function invitePeerRater(
  companyId: string,
  session: AccessClaims,
  participantId: string,
  input: InviteRaterInput,
  meta?: Meta,
) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: {
      id: true,
      employeeId: true,
      campaignId: true,
      employee: { select: { managerId: true, firstName: true, lastName: true } },
      campaign: { select: { name: true, cycle: true, status: true } },
    },
  });
  if (!participant) throw NotFound("ไม่พบผู้เข้าร่วมการประเมิน");

  const managesTarget = participant.employee.managerId === session.employeeId;
  if (!isHrLevel(session) && !managesTarget) {
    throw Forbidden("เชิญผู้ประเมินได้เฉพาะทีมที่คุณดูแล");
  }

  const rater = await prisma.employee.findFirst({
    where: { id: input.raterEmployeeId, companyId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (!rater) throw NotFound("ไม่พบพนักงานที่เลือก");
  if (input.raterEmployeeId === participant.employeeId) {
    throw BadRequest("ไม่สามารถเชิญตนเองเป็นผู้ประเมินเพิ่มเติมได้");
  }
  if (input.raterType === "UPWARD" && rater.managerId !== participant.employeeId) {
    throw BadRequest("ผู้ประเมินแบบ Upward ต้องเป็นผู้ใต้บังคับบัญชาของผู้ถูกประเมินเท่านั้น");
  }

  const response = await prisma.evaluationResponse.create({
    data: {
      participantId,
      raterType: input.raterType,
      raterEmployeeId: input.raterEmployeeId,
      scores: [],
    },
    select: { id: true },
  });

  if (participant.campaign.status === "ACTIVE") {
    await createNotification(
      companyId,
      input.raterEmployeeId,
      {
        title: "คุณได้รับเชิญให้ร่วมประเมิน",
        body: `ในฐานะ${RATER_LABEL[input.raterType] ?? input.raterType} — ${participant.employee.firstName} ${participant.employee.lastName} · ${participant.campaign.name} · ${participant.campaign.cycle}`,
        category: "performance",
        link: `/performance/campaigns/${participant.campaignId}/participants/${participantId}`,
      },
      session.sub,
    );
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.invite_rater",
    entity: "EvaluationParticipant",
    entityId: participantId,
    after: { raterType: input.raterType, raterEmployeeId: input.raterEmployeeId },
    ...meta,
  });

  return { id: response.id };
}

export async function removeRater(companyId: string, session: AccessClaims, responseId: string, meta?: Meta) {
  const response = await prisma.evaluationResponse.findFirst({
    where: { id: responseId, participant: { campaign: { companyId, deletedAt: null } } },
    select: {
      id: true,
      status: true,
      raterType: true,
      participantId: true,
      participant: { select: { employeeId: true, employee: { select: { managerId: true } } } },
    },
  });
  if (!response) throw NotFound("ไม่พบผู้ประเมิน");
  if (response.raterType !== "PEER" && response.raterType !== "UPWARD" && response.raterType !== "HR_EXEC") {
    throw BadRequest("ยกเลิกได้เฉพาะผู้ประเมินที่เชิญเป็นรายบุคคล (Peer/Upward/HR)");
  }
  if (response.status !== "PENDING") {
    throw BadRequest("ผู้ประเมินคนนี้ส่งแบบประเมินไปแล้ว");
  }

  const managesTarget = response.participant.employee.managerId === session.employeeId;
  if (!isHrLevel(session) && !managesTarget) {
    throw Forbidden("ยกเลิกได้เฉพาะทีมที่คุณดูแล");
  }

  await prisma.evaluationResponse.delete({ where: { id: response.id } });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.remove_rater",
    entity: "EvaluationParticipant",
    entityId: response.participantId,
    before: { raterType: response.raterType },
    ...meta,
  });

  return { ok: true as const };
}

/**
 * Score <= evalThresholdUrgentMax (URGENT): auto-create (or reuse, if one
 * already exists for this employee+cycle) an improvement plan seeded from
 * the participant's lowest-scoring topics, and notify the employee's
 * manager + every HR-level user. Called only from finalizeParticipant —
 * "auto-generated" per the spec means at the moment a result becomes
 * official, not on every intermediate score recompute.
 */
async function maybeCreateImprovementPlan(
  companyId: string,
  participantId: string,
  session: AccessClaims,
) {
  const participant = await prisma.evaluationParticipant.findUniqueOrThrow({
    where: { id: participantId },
    select: {
      scoreStatus: true,
      lowestTopics: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true, managerId: true } },
      campaign: { select: { name: true, cycle: true, followUpDate: true } },
    },
  });
  if (participant.scoreStatus !== "URGENT") return;

  const cycle = participant.campaign.cycle;
  const topics = (participant.lowestTopics as { key: string; label: string; score: number; maxScore: number }[] | null) ?? [];

  const plan = await prisma.developmentPlan.upsert({
    where: { employeeId_cycle: { employeeId: participant.employeeId, cycle } },
    create: {
      companyId,
      employeeId: participant.employeeId,
      cycle,
      participantId,
      managerId: participant.employee.managerId,
      autoGenerated: true,
      createdById: session.sub,
      updatedById: session.sub,
      items: {
        create: topics.map((t) => ({
          title: t.label,
          problemDescription: `คะแนนหัวข้อนี้อยู่ที่ ${t.score}/${t.maxScore} ซึ่งต่ำกว่าเกณฑ์`,
          followUpDate: participant.campaign.followUpDate,
        })),
      },
    },
    update: { participantId, autoGenerated: true, updatedById: session.sub },
    select: { id: true },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "development_plan.auto_generate",
    entity: "DevelopmentPlan",
    entityId: plan.id,
    after: { employeeId: participant.employeeId, cycle, reason: "URGENT score" },
  });

  const employeeName = `${participant.employee.firstName} ${participant.employee.lastName}`;
  const notifyBody = `${employeeName} มีคะแนนประเมิน ${participant.campaign.name} · ${cycle} อยู่ในเกณฑ์ต้องแก้ไขเร่งด่วน ระบบสร้างแผนพัฒนาให้อัตโนมัติแล้ว`;
  const recipients = new Set<string>();
  if (participant.employee.managerId) recipients.add(participant.employee.managerId);
  const hrEmployees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      user: { roles: { some: { role: { permissions: { some: { permission: { key: "campaign:approve" } } } } } } },
    },
    select: { id: true },
  });
  hrEmployees.forEach((e) => recipients.add(e.id));

  for (const employeeId of recipients) {
    await createNotification(
      companyId,
      employeeId,
      { title: "มีพนักงานคะแนนประเมินต่ำกว่าเกณฑ์", body: notifyBody, category: "performance", link: `/performance/campaigns/${participantId}` },
      session.sub,
    );
  }
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

  await maybeCreateImprovementPlan(companyId, participantId, session);

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

/** Employee acknowledges their own finalized result — required before HR can
 * consider the cycle's feedback loop closed for that person. */
export async function acknowledgeResult(companyId: string, session: AccessClaims, participantId: string, meta?: Meta) {
  const participant = await prisma.evaluationParticipant.findFirst({
    where: { id: participantId, campaign: { companyId, deletedAt: null } },
    select: { id: true, employeeId: true, finalizedAt: true },
  });
  if (!participant) throw NotFound("ไม่พบผลการประเมิน");
  if (participant.employeeId !== session.employeeId) throw Forbidden("รับทราบได้เฉพาะผลของตนเอง");
  if (!participant.finalizedAt) throw BadRequest("ผลการประเมินยังไม่สรุป ยังไม่สามารถรับทราบได้");

  await prisma.evaluationParticipant.update({
    where: { id: participantId },
    data: { employeeAcknowledged: true, acknowledgedAt: new Date() },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.acknowledge_result",
    entity: "EvaluationParticipant",
    entityId: participantId,
    ...meta,
  });

  return { ok: true as const };
}

export async function getEmployeeEvaluationHistory(
  companyId: string,
  employeeId: string,
  session: AccessClaims,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, managerId: true },
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  const hrLevel = isHrLevel(session);
  const own = employee.id === session.employeeId;
  const manages = employee.managerId === session.employeeId;
  if (!hrLevel && !own && !manages) {
    throw Forbidden("ไม่มีสิทธิ์ดูข้อมูลนี้");
  }

  const rows = await prisma.evaluationParticipant.findMany({
    where: { employeeId, campaign: { companyId, deletedAt: null } },
    select: {
      id: true,
      overallScore: true,
      band: true,
      calibratedScore: true,
      calibratedBand: true,
      finalizedAt: true,
      campaign: {
        select: { id: true, name: true, cycle: true, status: true, startDate: true, endDate: true },
      },
    },
    orderBy: { campaign: { startDate: "desc" } },
  });

  return rows.map((r) => ({
    participantId: r.id,
    overallScore: r.overallScore,
    band: r.band,
    // Calibration (when it's happened) supersedes the raw manager score —
    // same fallback the 9-Box/calibration views already use.
    calibratedScore: r.calibratedScore,
    calibratedBand: r.calibratedBand,
    finalizedAt: r.finalizedAt,
    campaign: r.campaign,
  }));
}

const thresholdSelect = {
  evalThresholdUrgentMax: true,
  evalThresholdWatchMax: true,
  evalThresholdGoodMin: true,
} satisfies Prisma.CompanySelect;

/** HR-editable score bands (%) — see EvaluationScoreStatus. Never hardcoded
 * in the frontend; read fresh on every score computation. */
export async function getEvaluationThresholds(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: thresholdSelect });
  return company;
}

export async function updateEvaluationThresholds(
  companyId: string,
  input: { evalThresholdUrgentMax: number; evalThresholdWatchMax: number; evalThresholdGoodMin: number },
  session: AccessClaims,
  meta?: Meta,
) {
  const before = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: thresholdSelect });
  const updated = await prisma.company.update({ where: { id: companyId }, data: input, select: thresholdSelect });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "campaign.update_thresholds",
    entity: "Company",
    entityId: companyId,
    before,
    after: updated,
    ...meta,
  });

  return updated;
}
