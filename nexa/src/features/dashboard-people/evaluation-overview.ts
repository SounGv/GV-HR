import { displayName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/auth/rbac";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { getSettings } from "@/features/appraisal-round/results-service";
import { participantScope, viewableEmployeeIds } from "@/features/appraisal-round/viewer-scope";
import { summarizeResults, summarizeRound, type ResultSummary, type RoundSummary } from "./evaluation-rules";

/**
 * What the evaluation section of the home page shows, read from the appraisal rounds HR runs at /appraisal.
 * Nothing here scores anyone: results are shown only after HR has calculated and approved them, and the ranking
 * only to people who may approve. Sequential queries (the connection pool has one slot).
 */

export interface OpenRound {
  id: string;
  name: string;
  /** Bangkok calendar day the round closes, or null when no end date was set. */
  endIso: string | null;
  daysLeft: number | null;
  summary: RoundSummary;
  href: string;
}

export interface ResultsCard extends ResultSummary {
  roundId: string;
  roundName: string;
  /** People in the round who have no approved result yet. */
  missing: number;
  /** Only filled for people who may approve results. */
  top: ResultSummary["top"];
  showRanking: boolean;
  href: string;
}

export interface MyTeamTask {
  assignmentId: string;
  roundId: string;
  person: string;
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED";
}

export interface EvaluationOverview {
  companyWide: boolean;
  open: OpenRound[];
  results: ResultsCard | null;
  /** The latest closed round that nobody has calculated yet (HR only). */
  awaitingCalculation: { id: string; name: string; href: string } | null;
  draftCount: number;
  /** Forms the viewer must fill in for their team, in open rounds. */
  myTasks: MyTeamTask[];
}

const APPROVED = ["APPROVED", "PUBLISHED", "ACKNOWLEDGED"] as const;
const MAX_OPEN_ROUNDS = 3;

function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * @param opts.limitTo narrows the people further (the AI Assistant passes the people its own access scope allows),
 *   so a wider role can never show more through the assistant than it is allowed to.
 */
export async function loadEvaluationOverview(companyId: string, session: AccessClaims, opts: { limitTo?: Set<string> } = {}): Promise<EvaluationOverview> {
  let ids = await viewableEmployeeIds(companyId, session);
  if (opts.limitTo) ids = ids ? new Set([...ids].filter((id) => opts.limitTo!.has(id))) : opts.limitTo;
  const scope = participantScope(ids);
  const today = bangkokParts().dateUTC;

  const rounds = await prisma.appraisalRound.findMany({
    where: { companyId, deletedAt: null, status: "OPEN" },
    select: { id: true, name: true, endDate: true },
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
    take: MAX_OPEN_ROUNDS,
  });

  const open: OpenRound[] = [];
  const myTasks: MyTeamTask[] = [];
  for (const r of rounds) {
    const participants = await prisma.appraisalParticipant.findMany({
      where: { roundId: r.id, ...scope },
      select: {
        departmentName: true,
        employee: { select: { id: true, firstName: true, lastName: true, nickname: true } },
        assignments: { select: { id: true, raterType: true, status: true, raterEmployeeId: true } },
      },
      take: 2000,
    });
    const end = r.endDate ? bangkokParts(r.endDate).dateUTC : null;
    open.push({
      id: r.id,
      name: r.name,
      endIso: end ? end.toISOString().slice(0, 10) : null,
      daysLeft: end ? dayDiff(today, end) : null,
      summary: summarizeRound(
        participants.map((p) => ({
          employeeId: p.employee.id,
          name: displayName(p.employee),
          department: p.departmentName ?? "ไม่ระบุแผนก",
          assignments: p.assignments.map((a) => ({ raterType: a.raterType, status: a.status })),
        })),
      ),
      href: `/appraisal/rounds/${r.id}`,
    });
    // The forms this person has to fill in for people under them (a manager's own queue).
    if (ids && session.employeeId) {
      for (const p of participants) {
        for (const a of p.assignments) {
          if (a.raterEmployeeId === session.employeeId && a.raterType === "MANAGER") {
            myTasks.push({ assignmentId: a.id, roundId: r.id, person: displayName(p.employee), status: a.status });
          }
        }
      }
    }
  }

  const isHr = can(session.perms, "campaign:update");
  const canRank = can(session.perms, "campaign:approve");

  // Results: the most recent round that has approved results in the viewer's scope.
  let results: ResultsCard | null = null;
  const latest = await prisma.appraisalParticipant.findFirst({
    where: { round: { companyId, deletedAt: null }, resultStatus: { in: [...APPROVED] }, scorePercent: { not: null }, ...scope },
    orderBy: [{ round: { closedAt: "desc" } }, { round: { createdAt: "desc" } }],
    select: { roundId: true, round: { select: { name: true } } },
  });
  if (latest) {
    const rows = await prisma.appraisalParticipant.findMany({
      where: { roundId: latest.roundId, resultStatus: { in: [...APPROVED] }, scorePercent: { not: null }, ...scope },
      select: { departmentName: true, scorePercent: true, grade: true, employee: { select: { id: true, firstName: true, lastName: true, nickname: true } } },
      take: 2000,
    });
    const everyone = await prisma.appraisalParticipant.count({ where: { roundId: latest.roundId, ...scope } });
    const settings = await getSettings(companyId);
    const summary = summarizeResults(
      rows.map((r) => ({
        employeeId: r.employee.id,
        name: displayName(r.employee),
        department: r.departmentName ?? "ไม่ระบุแผนก",
        scorePercent: r.scorePercent as number,
        grade: r.grade,
      })),
      [...settings.bands].sort((a, b) => b.minPercent - a.minPercent).map((b) => b.label),
    );
    if (summary) {
      results = {
        ...summary,
        roundId: latest.roundId,
        roundName: latest.round.name,
        missing: Math.max(0, everyone - summary.count),
        top: canRank ? summary.top : [],
        showRanking: canRank,
        href: `/appraisal/rounds/${latest.roundId}`,
      };
    }
  }

  // HR only: a closed round whose results were never calculated.
  let awaitingCalculation: EvaluationOverview["awaitingCalculation"] = null;
  if (isHr) {
    const closed = await prisma.appraisalRound.findFirst({
      where: { companyId, deletedAt: null, status: "CLOSED", participants: { some: {}, none: { resultStatus: { not: "NOT_CALCULATED" } } } },
      orderBy: { closedAt: "desc" },
      select: { id: true, name: true },
    });
    if (closed) awaitingCalculation = { id: closed.id, name: closed.name, href: `/appraisal/rounds/${closed.id}` };
  }

  const draftCount = isHr ? await prisma.appraisalRound.count({ where: { companyId, deletedAt: null, status: "DRAFT" } }) : 0;

  return { companyWide: ids === null, open, results, awaitingCalculation, draftCount, myTasks };
}
