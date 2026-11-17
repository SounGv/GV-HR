import { displayName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { NotFound } from "@/lib/api/errors";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { MAX_ADJUST_POINTS } from "./adjust-rules";
import { participantScope, viewableEmployeeIds } from "./viewer-scope";
import { getSettings } from "./results-service";
import { pickForm, type RoundSnapshot } from "./form-snapshot";
import { raterPercent, type PersonResult } from "./scoring";
import type { Answer } from "./answers";
import {
  MANAGER_GAP_POINTS,
  MIN_PEOPLE_PER_MANAGER,
  SELF_GAP_POINTS,
  bandsHighToLow,
  gradeSpread,
  personFlags,
  summarizeManagers,
  ceilingSummary,
} from "./review-rules";
import type { ReviewPerson, RoundReview } from "./types";

/**
 * Everything the review page shows for one round, worked out from what is already stored. Read only: it never writes
 * and never changes a score. Sequential queries (the connection pool has one slot).
 *
 * The caller must hold `campaign:approve` or `campaign:update`; the people are further limited to what
 * `viewableEmployeeIds` allows, so an approver with a team scope sees only that team (and "company average" then
 * means the average of those people).
 */
export async function getRoundReview(companyId: string, session: AccessClaims, roundId: string): Promise<RoundReview> {
  const round = await prisma.appraisalRound.findFirst({
    where: { id: roundId, companyId, deletedAt: null },
    select: { name: true, status: true, formSnapshot: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");

  const ids = await viewableEmployeeIds(companyId, session);
  const settings = await getSettings(companyId);
  const bands = bandsHighToLow(settings.bands);
  const snapshot = round.formSnapshot as unknown as RoundSnapshot | null;

  const participants = await prisma.appraisalParticipant.findMany({
    where: { roundId, ...participantScope(ids, session.employeeId) },
    select: {
      id: true,
      formId: true,
      departmentName: true,
      resultStatus: true,
      scorePercent: true,
      grade: true,
      scoreBreakdown: true,
      adjustedAt: true,
      originalScorePercent: true,
      employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true } },
      assignments: {
        where: { status: "SUBMITTED", raterType: "MANAGER" },
        select: { raterEmployeeId: true, answers: true, rater: { select: { firstName: true, lastName: true, nickname: true } } },
      },
    },
    take: 2000,
  });

  const people: ReviewPerson[] = [];
  let importedPeople = 0;
  const given = new Map<string, { name: string; percents: number[] }>();
  for (const p of participants) {
    // How generously each manager scored: the same question weights and calculation mode the result uses.
    const form = pickForm(snapshot, p.formId);
    if (form) {
      for (const a of p.assignments) {
        const pct = raterPercent(form.questions, "MANAGER", Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : [], form.ratingMax, settings.calcMode);
        if (pct === null) continue;
        const entry = given.get(a.raterEmployeeId) ?? { name: displayName(a.rater), percents: [] };
        entry.percents.push(pct);
        given.set(a.raterEmployeeId, entry);
      }
    }
    if (p.scorePercent === null || p.resultStatus === "NOT_CALCULATED") continue;
    if ((p.scoreBreakdown as { source?: string } | null)?.source === "favpo-import") importedPeople++;
    const types = (p.scoreBreakdown as unknown as PersonResult | null)?.types ?? [];
    const percentOf = (t: string) => types.find((x) => x.raterType === t)?.percent ?? null;
    const self = percentOf("SELF");
    const manager = percentOf("MANAGER");
    people.push({
      participantId: p.id,
      name: displayName(p.employee),
      code: p.employee.employeeCode,
      department: p.departmentName ?? "ไม่ระบุแผนก",
      status: p.resultStatus,
      self,
      manager,
      total: p.scorePercent,
      grade: p.grade,
      ...personFlags(self, manager, p.scorePercent, bands),
      adjusted: p.adjustedAt !== null,
      original: p.adjustedAt !== null ? p.originalScorePercent : null,
    });
  }
  // The people who need a look come first, then by department and name.
  people.sort((a, b) => Number(b.talk || b.nearEdge) - Number(a.talk || a.nearEdge) || a.department.localeCompare(b.department, "th") || a.name.localeCompare(b.name, "th"));

  const history = await prisma.appraisalScoreAdjustment.findMany({
    where: { participant: { roundId, ...participantScope(ids, session.employeeId) } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      participantId: true,
      kind: true,
      fromPercent: true,
      toPercent: true,
      fromGrade: true,
      toGrade: true,
      reason: true,
      byName: true,
      createdAt: true,
      participant: { select: { employee: { select: { firstName: true, lastName: true, nickname: true } } } },
    },
  });

  const departments = [...new Set(people.map((p) => p.department))].sort((a, b) => a.localeCompare(b, "th"));
  const spreadOf = (rows: ReviewPerson[]) => gradeSpread(rows.map((r) => r.total), bands);

  return {
    roundName: round.name,
    status: round.status,
    total: participants.length,
    calculated: people.length,
    imported: people.length > 0 && importedPeople === people.length,
    ceiling: ceilingSummary(people.map((p) => p.total)),
    bands: bands.map((b) => b.label),
    spread: {
      ...spreadOf(people),
      byDepartment: departments.map((department) => {
        const rows = people.filter((p) => p.department === department);
        return { department, total: rows.length, ...spreadOf(rows) };
      }),
    },
    companyWide: ids === null,
    managers: summarizeManagers([...given.entries()].map(([managerId, g]) => ({ managerId, name: g.name, percents: g.percents }))),
    people,
    adjustments: history.map((h) => ({
      id: h.id,
      participantId: h.participantId,
      name: displayName(h.participant.employee),
      kind: h.kind,
      fromPercent: h.fromPercent,
      toPercent: h.toPercent,
      fromGrade: h.fromGrade,
      toGrade: h.toGrade,
      reason: h.reason,
      byName: h.byName,
      createdAt: h.createdAt.toISOString(),
    })),
    canAdjust: can(session.perms, "campaign:update"),
    thresholds: { managerGap: MANAGER_GAP_POINTS, selfGap: SELF_GAP_POINTS, minPeople: MIN_PEOPLE_PER_MANAGER, maxAdjust: MAX_ADJUST_POINTS },
  };
}
