import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { RecognitionCreateInput, RecognitionListQuery } from "./schema";

type Meta = { ip?: string; userAgent?: string };

const select = {
  id: true,
  type: true,
  points: true,
  message: true,
  createdAt: true,
  givenByEmployeeId: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("recognition:*");
}

export async function createRecognition(
  companyId: string,
  session: AccessClaims,
  input: RecognitionCreateInput,
  meta?: Meta,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId, deletedAt: null },
    select: { id: true, managerId: true },
  });
  if (!employee) throw NotFound("ไม่พบพนักงาน");

  const isManager = employee.managerId === session.employeeId;
  if (!isManager && !isHrLevel(session)) {
    throw Forbidden("ให้กำลังใจได้เฉพาะทีมที่คุณดูแล");
  }

  const record = await prisma.recognition.create({
    data: {
      companyId,
      employeeId: input.employeeId,
      givenByUserId: session.sub,
      givenByEmployeeId: session.employeeId ?? null,
      type: input.type,
      points: input.type === "POINT" ? (input.points ?? 0) : 0,
      message: input.message,
      createdById: session.sub,
    },
    select,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "recognition.create",
    entity: "Recognition",
    entityId: record.id,
    after: { employeeId: input.employeeId, type: input.type, points: record.points },
    ...meta,
  });

  return record;
}

export async function listRecognition(
  companyId: string,
  session: AccessClaims,
  query: RecognitionListQuery,
) {
  let employeeIds: string[] | undefined;

  if (query.scope === "me") {
    if (!session.employeeId) return [];
    employeeIds = [session.employeeId];
  } else if (query.scope === "team") {
    const reports = await prisma.employee.findMany({
      where: { companyId, managerId: session.employeeId ?? "__none__", deletedAt: null },
      select: { id: true },
    });
    employeeIds = reports.map((r) => r.id);
    if (employeeIds.length === 0) return [];
  }

  return prisma.recognition.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
    },
    select,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getRecognitionSummary(
  companyId: string,
  session: AccessClaims,
  employeeId: string,
) {
  if (employeeId !== session.employeeId) {
    const target = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { managerId: true },
    });
    if (!target) throw NotFound("ไม่พบพนักงาน");
    const managesTarget = target.managerId === session.employeeId;
    if (!managesTarget && !isHrLevel(session)) throw Forbidden("ไม่มีสิทธิ์ดูข้อมูลนี้");
  }

  const rows = await prisma.recognition.groupBy({
    by: ["type"],
    where: { companyId, employeeId, deletedAt: null },
    _count: { _all: true },
    _sum: { points: true },
  });

  const summary = { star: 0, award: 0, heart: 0, point: 0 };
  for (const row of rows) {
    if (row.type === "STAR") summary.star = row._count._all;
    else if (row.type === "AWARD") summary.award = row._count._all;
    else if (row.type === "HEART") summary.heart = row._count._all;
    else if (row.type === "POINT") summary.point = row._sum.points ?? 0;
  }
  return summary;
}
