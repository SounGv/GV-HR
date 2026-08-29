import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { computeOverall, scoreBand, type Competency } from "./calc";
import type { ReviewCreateInput, ReviewListQuery, ReviewUpdateInput } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const json = (v: unknown) => v as Prisma.InputJsonValue;

const reviewSelect = {
  id: true,
  cycle: true,
  overallScore: true,
  band: true,
  competencies: true,
  strengths: true,
  improvements: true,
  summary: true,
  status: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      managerId: true,
    },
  },
} satisfies Prisma.PerformanceReviewSelect;

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

/**
 * Wildcard grants like "performance:*" are expanded into concrete permission
 * keys at seed time (see `expandPermissions`), so `session.perms` never
 * literally contains "performance:*" — checking the real, HR-exclusive
 * `performance:approve` (Manager doesn't have it) is what actually works.
 */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("performance:approve");
}

async function assertCanReview(companyId: string, session: AccessClaims, employeeId: string) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { managerId: true },
  });
  if (!emp) throw NotFound("ไม่พบพนักงาน");
  if (emp.managerId !== session.employeeId && !isHrLevel(session)) {
    throw Forbidden("ประเมินได้เฉพาะทีมที่คุณดูแล");
  }
}

export async function createReview(
  companyId: string,
  session: AccessClaims,
  input: ReviewCreateInput,
  meta?: Meta,
) {
  await assertCanReview(companyId, session, input.employeeId);

  const overall = computeOverall(input.competencies as Competency[]);
  const band = scoreBand(overall);

  const record = await prisma.performanceReview.create({
    data: {
      companyId,
      employeeId: input.employeeId,
      reviewerEmployeeId: session.employeeId ?? null,
      reviewerUserId: session.sub,
      cycle: input.cycle,
      overallScore: overall,
      band,
      competencies: json(input.competencies),
      strengths: input.strengths,
      improvements: input.improvements,
      summary: input.summary,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: reviewSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "performance.create",
    entity: "PerformanceReview",
    entityId: record.id,
    after: { employeeId: input.employeeId, cycle: input.cycle, overall, band },
    ...meta,
  });

  return record;
}

export async function listReviews(
  companyId: string,
  session: AccessClaims,
  query: ReviewListQuery,
) {
  let employeeIds: string[] | undefined;

  if (query.scope === "me") {
    employeeIds = [requireEmployeeId(session)];
  } else if (query.scope === "team") {
    const reports = await prisma.employee.findMany({
      where: { companyId, managerId: session.employeeId ?? "__none__", deletedAt: null },
      select: { id: true },
    });
    employeeIds = reports.map((r) => r.id);
    if (employeeIds.length === 0) return [];
  }

  return prisma.performanceReview.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
    },
    select: reviewSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getReview(companyId: string, session: AccessClaims, id: string) {
  const record = await prisma.performanceReview.findFirst({
    where: { id, companyId, deletedAt: null },
    select: reviewSelect,
  });
  if (!record) throw NotFound("ไม่พบผลการประเมิน");

  const own = record.employee.id === session.employeeId;
  const managesTarget = record.employee.managerId === session.employeeId;
  if (!own && !managesTarget && !isHrLevel(session)) {
    throw Forbidden("ไม่มีสิทธิ์ดูผลการประเมินนี้");
  }
  return record;
}

export interface DepartmentSummaryRow {
  department: string;
  employeeCount: number;
  reviewedCount: number;
  averageScore: number;
  bandCounts: Record<string, number>;
}

/**
 * Company-wide performance rollup by department — HR-level only. Uses each
 * employee's most recent PerformanceReview (if any) so it reflects current
 * standing rather than every historical review ever filed.
 */
export async function getDepartmentSummary(companyId: string, session: AccessClaims): Promise<DepartmentSummaryRow[]> {
  if (!isHrLevel(session)) throw Forbidden("ดูสรุปผลระดับแผนกได้เฉพาะฝ่ายบุคคล");

  // Sequential, not Promise.all — connection_limit=1.
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, department: { select: { name: true } } },
  });
  const reviews = await prisma.performanceReview.findMany({
    where: { companyId, deletedAt: null },
    select: { employeeId: true, overallScore: true, band: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const latestByEmployee = new Map<string, { overallScore: number; band: string }>();
  for (const r of reviews) {
    if (!latestByEmployee.has(r.employeeId)) {
      latestByEmployee.set(r.employeeId, { overallScore: r.overallScore, band: r.band });
    }
  }

  const byDept = new Map<string, { employeeCount: number; scores: number[]; bandCounts: Record<string, number> }>();
  for (const e of employees) {
    const deptName = e.department?.name ?? "ไม่มีแผนก";
    const row = byDept.get(deptName) ?? { employeeCount: 0, scores: [], bandCounts: {} };
    row.employeeCount += 1;
    const latest = latestByEmployee.get(e.id);
    if (latest) {
      row.scores.push(latest.overallScore);
      row.bandCounts[latest.band] = (row.bandCounts[latest.band] ?? 0) + 1;
    }
    byDept.set(deptName, row);
  }

  return [...byDept.entries()]
    .map(([department, v]) => ({
      department,
      employeeCount: v.employeeCount,
      reviewedCount: v.scores.length,
      averageScore: v.scores.length ? Math.round((v.scores.reduce((s, x) => s + x, 0) / v.scores.length) * 100) / 100 : 0,
      bandCounts: v.bandCounts,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

export async function updateReview(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: ReviewUpdateInput,
  meta?: Meta,
) {
  const existing = await prisma.performanceReview.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employee: { select: { managerId: true } } },
  });
  if (!existing) throw NotFound("ไม่พบผลการประเมิน");
  if (existing.employee.managerId !== session.employeeId && !isHrLevel(session)) {
    throw Forbidden("แก้ไขได้เฉพาะทีมที่คุณดูแล");
  }

  const data: Prisma.PerformanceReviewUpdateInput = {
    updatedById: session.sub,
    ...(input.cycle !== undefined ? { cycle: input.cycle } : {}),
    ...(input.strengths !== undefined ? { strengths: input.strengths } : {}),
    ...(input.improvements !== undefined ? { improvements: input.improvements } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
  };
  if (input.competencies) {
    const overall = computeOverall(input.competencies as Competency[]);
    data.competencies = json(input.competencies);
    data.overallScore = overall;
    data.band = scoreBand(overall);
  }

  const record = await prisma.performanceReview.update({
    where: { id },
    data,
    select: reviewSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "performance.update",
    entity: "PerformanceReview",
    entityId: id,
    ...meta,
  });

  return record;
}
