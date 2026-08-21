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

const keyResultSelect = {
  id: true,
  title: true,
  unit: true,
  targetValue: true,
  currentValue: true,
  weight: true,
  status: true,
} satisfies Prisma.GoalSelect;

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
  parentGoalId: true,
  keyResults: {
    where: { deletedAt: null },
    select: keyResultSelect,
    orderBy: { createdAt: "asc" },
  },
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

/**
 * An Objective's own currentValue/targetValue stay untouched (never
 * silently overwritten from key-result data) — rollup is computed fresh on
 * every read instead, so there's exactly one source of truth per Key Result
 * and no risk of the two drifting apart.
 */
export function rollupKeyResults(
  keyResults: { targetValue: number; currentValue: number; weight: number }[],
): { percent: number; status: GoalCreateInput["status"] } | null {
  if (keyResults.length === 0) return null;
  const totalWeight = keyResults.reduce((s, k) => s + k.weight, 0) || keyResults.length;
  const percent = Math.round(
    keyResults.reduce((sum, k) => {
      const pct = k.targetValue > 0 ? Math.min(100, (k.currentValue / k.targetValue) * 100) : 0;
      return sum + pct * (k.weight / totalWeight);
    }, 0),
  );
  const allCompleted = keyResults.every((k) => k.targetValue > 0 && k.currentValue >= k.targetValue);
  const anyStarted = keyResults.some((k) => k.currentValue > 0);
  const status: GoalCreateInput["status"] = allCompleted ? "COMPLETED" : anyStarted ? "IN_PROGRESS" : "NOT_STARTED";
  return { percent, status };
}

type GoalWithKeyResults = Prisma.GoalGetPayload<{ select: typeof goalSelect }>;

/** Attach the live-computed rollup (never stored) so the client never has to re-derive it. */
function withRollup<T extends GoalWithKeyResults>(goal: T) {
  return { ...goal, rollup: rollupKeyResults(goal.keyResults) };
}

export async function getGoal(companyId: string, id: string) {
  const goal = await prisma.goal.findFirst({
    where: { id, companyId, deletedAt: null },
    select: goalSelect,
  });
  if (!goal) throw NotFound("ไม่พบเป้าหมาย");
  return withRollup(goal);
}

export async function createGoal(
  companyId: string,
  session: AccessClaims,
  input: GoalCreateInput,
  meta?: Meta,
) {
  let employeeId = input.employeeId;

  if (input.parentGoalId) {
    const parent = await prisma.goal.findFirst({
      where: { id: input.parentGoalId, companyId, deletedAt: null },
      select: { id: true, type: true, parentGoalId: true, employeeId: true },
    });
    if (!parent) throw BadRequest("ไม่พบ Objective ที่เลือก");
    if (parent.type !== "OKR") throw BadRequest("เพิ่ม Key Result ได้เฉพาะใต้ Objective ประเภท OKR");
    if (parent.parentGoalId) throw BadRequest("Key Result ซ้อนกันเกิน 1 ชั้นไม่ได้");
    // A Key Result always belongs to its Objective's owner — never a
    // different employee than the Objective it measures.
    employeeId = parent.employeeId;
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw BadRequest("ไม่พบพนักงานที่เลือก");

  const record = await prisma.goal.create({
    data: {
      companyId,
      employeeId,
      parentGoalId: input.parentGoalId ?? null,
      ownerEmployeeId: session.employeeId ?? null,
      ownerUserId: session.sub,
      title: input.title,
      description: input.description,
      type: input.parentGoalId ? "KPI" : input.type, // key results are measurable line items, not nested OKRs
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
    after: { title: input.title, employeeId, parentGoalId: input.parentGoalId },
    ...meta,
  });

  return withRollup(record);
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

  const goals = await prisma.goal.findMany({
    where: {
      companyId,
      deletedAt: null,
      parentGoalId: null, // Key Results are shown nested under their Objective, never as their own row
      ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      ...(query.cycle ? { cycle: query.cycle } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    select: goalSelect,
    orderBy: [{ cycle: "desc" }, { weight: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  return goals.map(withRollup);
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

  return withRollup(record);
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

  return withRollup(record);
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

  const deletedAt = new Date();
  await prisma.goal.update({
    where: { id: goal.id },
    data: { deletedAt, updatedById: session.sub },
  });
  // Soft-delete is an UPDATE, not a real row delete, so the FK's ON DELETE
  // CASCADE never fires — an Objective's Key Results would otherwise become
  // invisible orphans (not deleted, just no longer reachable from anywhere).
  await prisma.goal.updateMany({
    where: { parentGoalId: goal.id, deletedAt: null },
    data: { deletedAt, updatedById: session.sub },
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
