import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type {
  GoalCreateInput,
  GoalUpdateInput,
  GoalProgressInput,
  GoalListQuery,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

const goalSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  cycle: true,
  unit: true,
  targetValue: true,
  currentValue: true,
  weight: true,
  status: true,
  dueDate: true,
  createdAt: true,
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.GoalSelect;

/** Auto-derive status from progress unless an explicit terminal status is set. */
export function deriveStatus(
  current: number,
  target: number,
  explicit?: GoalCreateInput["status"],
): GoalCreateInput["status"] {
  if (explicit === "CANCELLED" || explicit === "AT_RISK") return explicit;
  if (target > 0 && current >= target) return "COMPLETED";
  if (current > 0) return "IN_PROGRESS";
  return explicit ?? "NOT_STARTED";
}

export async function getGoal(companyId: string, id: string) {
  const goal = await prisma.goal.findFirst({
    where: { id, companyId, deletedAt: null },
    select: goalSelect,
  });
  if (!goal) throw NotFound("ไม่พบเป้าหมาย");
  return goal;
}

export async function createGoal(
  companyId: string,
  session: AccessClaims,
  input: GoalCreateInput,
  meta?: Meta,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw BadRequest("ไม่พบพนักงานที่เลือก");

  const record = await prisma.goal.create({
    data: {
      companyId,
      employeeId: input.employeeId,
      ownerEmployeeId: session.employeeId ?? null,
      ownerUserId: session.sub,
      title: input.title,
      description: input.description,
      type: input.type,
      cycle: input.cycle,
      unit: input.unit,
      targetValue: input.targetValue,
      currentValue: input.currentValue,
      weight: input.weight,
      status: deriveStatus(input.currentValue, input.targetValue, input.status),
      dueDate: input.dueDate ?? null,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: goalSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "kpi.create",
    entity: "Goal",
    entityId: record.id,
    after: { title: input.title, employeeId: input.employeeId },
    ...meta,
  });

  return record;
}

export async function listGoals(
  companyId: string,
  session: AccessClaims,
  query: GoalListQuery,
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

  return prisma.goal.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.cycle ? { cycle: query.cycle } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    select: goalSelect,
    orderBy: [{ cycle: "desc" }, { weight: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
}

/** Full edit — caller must hold kpi:update (enforced at the route). */
export async function updateGoal(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: GoalUpdateInput,
  meta?: Meta,
) {
  const goal = await prisma.goal.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, targetValue: true, currentValue: true },
  });
  if (!goal) throw NotFound("ไม่พบเป้าหมาย");

  const nextTarget = input.targetValue ?? goal.targetValue;
  const nextCurrent = input.currentValue ?? goal.currentValue;

  const record = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.cycle !== undefined ? { cycle: input.cycle } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
      ...(input.currentValue !== undefined ? { currentValue: input.currentValue } : {}),
      ...(input.weight !== undefined ? { weight: input.weight } : {}),
      status: deriveStatus(nextCurrent, nextTarget, input.status),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate ?? null } : {}),
      updatedById: session.sub,
    },
    select: goalSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "kpi.update",
    entity: "Goal",
    entityId: goal.id,
    ...meta,
  });

  return record;
}

/** Progress-only update — allowed for the goal's own employee. */
export async function updateGoalProgress(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: GoalProgressInput,
  meta?: Meta,
) {
  const goal = await prisma.goal.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, employeeId: true, targetValue: true },
  });
  if (!goal) throw NotFound("ไม่พบเป้าหมาย");
  if (goal.employeeId !== session.employeeId) {
    throw Forbidden("อัปเดตความคืบหน้าได้เฉพาะเป้าหมายของตนเอง");
  }

  const record = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      currentValue: input.currentValue,
      status: deriveStatus(input.currentValue, goal.targetValue, input.status),
      updatedById: session.sub,
    },
    select: goalSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "kpi.progress",
    entity: "Goal",
    entityId: goal.id,
    after: { currentValue: input.currentValue },
    ...meta,
  });

  return record;
}

export async function deleteGoal(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const goal = await prisma.goal.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!goal) throw NotFound("ไม่พบเป้าหมาย");

  await prisma.goal.update({
    where: { id: goal.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "kpi.delete",
    entity: "Goal",
    entityId: goal.id,
    ...meta,
  });

  return { ok: true as const };
}
