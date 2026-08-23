import { prisma } from "@/lib/prisma";
import { NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";

export interface DashboardFilters {
  campaignId?: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  status?: "GOOD" | "NEEDS_IMPROVEMENT" | "WATCH" | "URGENT";
  scoreMin?: number;
  scoreMax?: number;
}

/**
 * HR Evaluation Dashboard — KPI cards, status/department/lowest-topic
 * charts, and a filterable participant table, all scoped to one selected
 * cycle (campaignId) at a time; defaults to the most recently started
 * non-DRAFT campaign when no cycle is specified. Every number here comes
 * straight from EvaluationParticipant's stored breakdown (phase 2c) —
 * nothing is recomputed or hardcoded.
 */
export async function getEvaluationDashboard(companyId: string, _session: AccessClaims, filters: DashboardFilters) {
  const campaign = filters.campaignId
    ? await prisma.evaluationCampaign.findFirst({
        where: { id: filters.campaignId, companyId, deletedAt: null },
        select: { id: true, name: true, cycle: true, status: true, startDate: true },
      })
    : await prisma.evaluationCampaign.findFirst({
        where: { companyId, deletedAt: null, status: { not: "DRAFT" } },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true, cycle: true, status: true, startDate: true },
      });
  if (!campaign) throw NotFound("ไม่พบรอบประเมิน");

  const participants = await prisma.evaluationParticipant.findMany({
    where: {
      campaignId: campaign.id,
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
      ...(filters.positionId ? { employee: { positionId: filters.positionId } } : {}),
      ...(filters.managerId ? { employee: { managerId: filters.managerId } } : {}),
      ...(filters.status ? { scoreStatus: filters.status } : {}),
      ...(filters.scoreMin != null ? { scorePercent: { gte: filters.scoreMin } } : {}),
      ...(filters.scoreMax != null ? { scorePercent: { lte: filters.scoreMax } } : {}),
    },
    select: {
      id: true,
      scorePercent: true,
      scoreStatus: true,
      finalizedAt: true,
      lowestTopics: true,
      employee: {
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
        },
      },
      responses: { select: { status: true } },
      // Improvement plan follow-up date, if one exists for this cycle.
      // (Loaded separately below since DevelopmentPlan keys by cycle string.)
    },
  });

  const employeeIds = participants.map((p) => p.employee.id);
  const plans = await prisma.developmentPlan.findMany({
    where: { companyId, cycle: campaign.cycle, employeeId: { in: employeeIds } },
    select: { employeeId: true, status: true, items: { select: { followUpDate: true } } },
  });
  const planByEmployee = new Map(plans.map((p) => [p.employeeId, p]));

  // ── KPI cards ──
  const totalParticipants = participants.length;
  const completed = participants.filter((p) => p.responses.some((r) => r.status === "SUBMITTED")).length;
  const notDone = totalParticipants - completed;
  const scored = participants.filter((p) => p.scorePercent != null);
  const avgScore = scored.length > 0 ? scored.reduce((s, p) => s + p.scorePercent!, 0) / scored.length : null;
  const countNeedsImprovementOrWatch = participants.filter((p) => p.scoreStatus === "NEEDS_IMPROVEMENT" || p.scoreStatus === "WATCH").length;
  const countUrgent = participants.filter((p) => p.scoreStatus === "URGENT").length;
  const pendingPlans = plans.filter((p) => p.status === "ACTIVE").length;

  // ── Charts ──
  const statusDistribution = (["GOOD", "NEEDS_IMPROVEMENT", "WATCH", "URGENT"] as const).map((status) => ({
    status,
    count: participants.filter((p) => p.scoreStatus === status).length,
  }));

  const byDepartment = new Map<string, { name: string; sum: number; count: number }>();
  for (const p of scored) {
    const key = p.employee.department?.id ?? "none";
    const name = p.employee.department?.name ?? "ไม่มีแผนก";
    const row = byDepartment.get(key) ?? { name, sum: 0, count: 0 };
    row.sum += p.scorePercent!;
    row.count++;
    byDepartment.set(key, row);
  }
  const avgByDepartment = [...byDepartment.values()].map((r) => ({ name: r.name, avgScore: Math.round((r.sum / r.count) * 10) / 10 }));

  const byPosition = new Map<string, { name: string; sum: number; count: number }>();
  for (const p of scored) {
    const key = p.employee.position?.id ?? "none";
    const name = p.employee.position?.title ?? "ไม่มีตำแหน่ง";
    const row = byPosition.get(key) ?? { name, sum: 0, count: 0 };
    row.sum += p.scorePercent!;
    row.count++;
    byPosition.set(key, row);
  }
  const avgByPosition = [...byPosition.values()].map((r) => ({ name: r.name, avgScore: Math.round((r.sum / r.count) * 10) / 10 }));

  const topicTally = new Map<string, { label: string; sum: number; count: number }>();
  for (const p of participants) {
    const topics = (p.lowestTopics as { key: string; label: string; score: number; maxScore: number }[] | null) ?? [];
    for (const t of topics) {
      const row = topicTally.get(t.label) ?? { label: t.label, sum: 0, count: 0 };
      row.sum += t.maxScore > 0 ? (t.score / t.maxScore) * 100 : 0;
      row.count++;
      topicTally.set(t.label, row);
    }
  }
  const lowestTopicsOverall = [...topicTally.values()]
    .map((r) => ({ label: r.label, avgScorePercent: Math.round((r.sum / r.count) * 10) / 10, mentions: r.count }))
    .sort((a, b) => a.avgScorePercent - b.avgScorePercent)
    .slice(0, 8);

  // Compare to the immediately-previous non-DRAFT campaign (by start date),
  // regardless of whether it shares the same template — a simple company-
  // wide "are we trending up or down" signal, not a like-for-like rescoring.
  const previousCampaign = await prisma.evaluationCampaign.findFirst({
    where: { companyId, deletedAt: null, status: { not: "DRAFT" }, startDate: { lt: campaign.startDate } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, cycle: true },
  });
  let previousAvgScore: number | null = null;
  if (previousCampaign) {
    const prevScored = await prisma.evaluationParticipant.aggregate({
      where: { campaignId: previousCampaign.id, scorePercent: { not: null } },
      _avg: { scorePercent: true },
    });
    previousAvgScore = prevScored._avg.scorePercent != null ? Math.round(prevScored._avg.scorePercent * 10) / 10 : null;
  }

  // ── Table ──
  const table = participants.map((p) => {
    const plan = planByEmployee.get(p.employee.id);
    const followUpDate = plan?.items.find((i) => i.followUpDate)?.followUpDate ?? null;
    return {
      participantId: p.id,
      employeeId: p.employee.id,
      employeeCode: p.employee.employeeCode,
      firstName: p.employee.firstName,
      lastName: p.employee.lastName,
      department: p.employee.department?.name ?? null,
      position: p.employee.position?.title ?? null,
      scorePercent: p.scorePercent,
      scoreStatus: p.scoreStatus,
      lowestTopic: ((p.lowestTopics as { label: string }[] | null) ?? [])[0]?.label ?? null,
      finalized: !!p.finalizedAt,
      planStatus: plan?.status ?? null,
      followUpDate,
    };
  });

  return {
    campaign: { id: campaign.id, name: campaign.name, cycle: campaign.cycle, status: campaign.status },
    kpi: {
      totalParticipants,
      completed,
      notDone,
      avgScore,
      countNeedsImprovementOrWatch,
      countUrgent,
      pendingPlans,
      previousCycleName: previousCampaign ? `${previousCampaign.name} · ${previousCampaign.cycle}` : null,
      previousAvgScore,
    },
    charts: { statusDistribution, avgByDepartment, avgByPosition, lowestTopicsOverall },
    table,
  };
}

export async function listDashboardCycles(companyId: string) {
  return prisma.evaluationCampaign.findMany({
    where: { companyId, deletedAt: null, status: { not: "DRAFT" } },
    select: { id: true, name: true, cycle: true },
    orderBy: { startDate: "desc" },
    take: 50,
  });
}
