import { prisma } from "@/lib/prisma";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { teamScopeFilter } from "@/features/employee/service";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";
import {
  DAY_MS,
  LEAVE_LOOKAHEAD_DAYS,
  PROBATION_FALLBACK_DAYS,
  PROBATION_WINDOW_DAYS,
  daysBetween,
  leaveBucket,
  probationDaysLeft,
  probationDeadline,
  tallyResponses,
  type ProbationDeadline,
  type ResponseTally,
} from "./rules";

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Stored dates can carry a time of day; compare them as Bangkok calendar days. */
const bangkokDay = (d: Date) => bangkokParts(d).dateUTC;
const fullName = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();

export interface LeavePerson {
  requestId: string;
  code: string;
  name: string;
  department: string;
  typeLabel: string;
  startIso: string;
  endIso: string;
  halfDay: boolean;
  hours: number | null;
}

export interface UpcomingLeaves {
  todayIso: string;
  lookaheadDays: number;
  today: LeavePerson[];
  soon: LeavePerson[];
}

/**
 * Approved leave covering today, or starting within the next week, for the
 * people the caller may see (team scope applied in the query). Only the leave
 * type is read; the reason and any attachment never leave the database.
 */
export async function loadUpcomingLeaves(companyId: string, session: AccessClaims): Promise<UpcomingLeaves> {
  const today = bangkokParts().dateUTC;
  const until = new Date(today.getTime() + LEAVE_LOOKAHEAD_DAYS * DAY_MS);
  const rows = await prisma.leaveRequest.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "APPROVED",
      startDate: { lte: until },
      endDate: { gte: today },
      employee: { deletedAt: null, ...(teamScopeFilter(session) ?? {}) },
    },
    select: {
      id: true,
      type: true,
      startDate: true,
      endDate: true,
      halfDay: true,
      unit: true,
      hours: true,
      employee: {
        select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    take: 300,
  });

  const result: UpcomingLeaves = { todayIso: iso(today), lookaheadDays: LEAVE_LOOKAHEAD_DAYS, today: [], soon: [] };
  for (const r of rows) {
    const bucket = leaveBucket(r.startDate, r.endDate, today);
    if (!bucket) continue;
    result[bucket].push({
      requestId: r.id,
      code: r.employee.employeeCode,
      name: fullName(r.employee),
      department: r.employee.department?.name ?? "ไม่ระบุแผนก",
      typeLabel: LEAVE_TYPE_LABEL[r.type] ?? r.type,
      startIso: iso(r.startDate),
      endIso: iso(r.endDate),
      halfDay: r.halfDay,
      hours: r.unit === "HOUR" ? r.hours : null,
    });
  }
  return result;
}

export interface ProbationPerson {
  employeeId: string;
  code: string;
  name: string;
  department: string;
  deadlineIso: string;
  daysLeft: number;
  source: ProbationDeadline["source"];
}

export interface ProbationDue {
  windowDays: number;
  people: ProbationPerson[];
  /** How many people in scope have a hire date or probation end date at all; the rest cannot be checked. */
  known: number;
  total: number;
}

/**
 * Employees whose probation ends within the next 30 days. Uses the probation
 * end date when HR entered one, otherwise the 120th day counted from the hire
 * date. `known`/`total` say how many people the list could be worked out for,
 * so a short list is never mistaken for "nobody is due".
 */
export async function loadProbationDue(companyId: string, session: AccessClaims): Promise<ProbationDue> {
  const today = bangkokParts().dateUTC;
  const windowEnd = new Date(today.getTime() + PROBATION_WINDOW_DAYS * DAY_MS);
  // hireDate such that hireDate + 119 days lands in [today, today + window].
  const hireFrom = new Date(today.getTime() - (PROBATION_FALLBACK_DAYS - 1) * DAY_MS);
  const hireTo = new Date(windowEnd.getTime() - (PROBATION_FALLBACK_DAYS - 1) * DAY_MS);
  const base = { companyId, deletedAt: null, status: "ACTIVE" as const, ...(teamScopeFilter(session) ?? {}) };

  const rows = await prisma.employee.findMany({
    where: {
      AND: [
        base,
        {
          OR: [
            { probationEndDate: { gte: today, lte: new Date(windowEnd.getTime() + DAY_MS) } },
            // Extra day each side because stored dates may carry a time of day; the rule below does the exact check.
            {
              probationEndDate: null,
              hireDate: { gte: new Date(hireFrom.getTime() - DAY_MS), lte: new Date(hireTo.getTime() + DAY_MS) },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      hireDate: true,
      probationEndDate: true,
      department: { select: { name: true } },
    },
    take: 200,
  });

  const people: ProbationPerson[] = [];
  for (const e of rows) {
    const deadline = probationDeadline(
      e.hireDate ? bangkokDay(e.hireDate) : null,
      e.probationEndDate ? bangkokDay(e.probationEndDate) : null,
    );
    const daysLeft = probationDaysLeft(deadline, today);
    if (!deadline || daysLeft === null) continue;
    people.push({
      employeeId: e.id,
      code: e.employeeCode,
      name: fullName(e),
      department: e.department?.name ?? "ไม่ระบุแผนก",
      deadlineIso: iso(deadline.date),
      daysLeft,
      source: deadline.source,
    });
  }
  people.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, "th"));

  const total = await prisma.employee.count({ where: base });
  const known = await prisma.employee.count({
    where: { AND: [base, { OR: [{ hireDate: { not: null } }, { probationEndDate: { not: null } }] }] },
  });
  return { windowDays: PROBATION_WINDOW_DAYS, people, known, total };
}

const RATER_LABEL: Record<string, string> = {
  SELF: "ประเมินตนเอง",
  MANAGER: "หัวหน้าประเมิน",
  PEER: "เพื่อนร่วมงานประเมิน",
  UPWARD: "ลูกน้องประเมินหัวหน้า",
  HR_EXEC: "HR/ผู้บริหารประเมิน",
};

export interface CampaignProgress {
  id: string;
  name: string;
  cycle: string;
  endIso: string;
  /** Negative once the closing date has passed but the round is still open. */
  daysLeft: number;
  overall: ResponseTally;
  byRater: { raterType: string; label: string; tally: ResponseTally }[];
}

/**
 * How far each open evaluation round has got: submitted / in progress / not
 * started, overall and per rater type. Counts only the responses of people in
 * the caller's team scope. Sequential per campaign (connection_limit=1).
 */
export async function loadEvaluationProgress(companyId: string, session: AccessClaims): Promise<CampaignProgress[]> {
  const today = bangkokParts().dateUTC;
  const scope = teamScopeFilter(session);
  const campaigns = await prisma.evaluationCampaign.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, cycle: true, endDate: true },
    orderBy: { endDate: "asc" },
    take: 5,
  });

  const result: CampaignProgress[] = [];
  for (const c of campaigns) {
    const responses = await prisma.evaluationResponse.findMany({
      where: { participant: { campaignId: c.id, ...(scope ? { employee: scope } : {}) } },
      select: { raterType: true, status: true },
    });
    const byType = new Map<string, ("PENDING" | "IN_PROGRESS" | "SUBMITTED")[]>();
    for (const r of responses) byType.set(r.raterType, [...(byType.get(r.raterType) ?? []), r.status]);
    result.push({
      id: c.id,
      name: c.name,
      cycle: c.cycle,
      endIso: iso(bangkokDay(c.endDate)),
      daysLeft: daysBetween(today, bangkokDay(c.endDate)),
      overall: tallyResponses(responses.map((r) => r.status)),
      byRater: [...byType.entries()].map(([raterType, statuses]) => ({
        raterType,
        label: RATER_LABEL[raterType] ?? raterType,
        tally: tallyResponses(statuses),
      })),
    });
  }
  return result;
}
