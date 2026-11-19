import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/api/errors";
import { notifyPermissionHolders } from "@/features/notification/service";
import {
  capLevel,
  decideEngine,
  ENGINE_NOTICE,
  FALLBACK_REPLY,
  monthStartBangkok,
  readCap,
  type EngineDecision,
  type EngineHealth,
} from "@/features/ai/engine-state";

/**
 * Where the AI service stands for a company, kept with no new table: each event is one audit-log row
 * (ai.engine.down / ai.engine.up / ai.chat / ai.cap), and the latest of them is the state. The administrators
 * (people who may edit employees) get one in-app notice per event, never one per question.
 */

const DOWN = "ai.engine.down";
const UP = "ai.engine.up";
const CHAT = "ai.chat";
const CAP = "ai.cap";
/** A down state older than this is forgotten, so a missed "up" event can never lock the fallback on. */
const STATE_MEMORY_MS = 48 * 3600 * 1000;
/** Whose notices these are. */
const NOTICE_PERMISSION = "employee:update";
/** Where the bell notices lead: the page that explains the state and the settings. */
const SETTINGS_LINK = "/ai/settings";

export const monthlyCap = () => readCap(process.env.AI_MONTHLY_CAP);

export async function getHealth(companyId: string, now = Date.now()): Promise<EngineHealth> {
  const last = await prisma.auditLog.findFirst({
    where: { companyId, action: { in: [DOWN, UP] }, createdAt: { gte: new Date(now - STATE_MEMORY_MS) } },
    orderBy: { createdAt: "desc" },
    select: { action: true, createdAt: true, after: true },
  });
  if (!last || last.action === UP) return { state: "ok" };
  const reason = (last.after as { reason?: string } | null)?.reason === "key" ? "key" : "credit";
  return { state: "down", since: last.createdAt.getTime(), reason };
}

export async function getUsage(companyId: string, now = new Date()): Promise<number> {
  return prisma.auditLog.count({ where: { companyId, action: CHAT, createdAt: { gte: monthStartBangkok(now) } } });
}

/** Everything the chat needs before it calls the service: who answers, and the numbers behind it. */
export async function engineStatus(companyId: string, now = new Date()) {
  const cap = monthlyCap();
  const health = await getHealth(companyId, now.getTime());
  const used = await getUsage(companyId, now);
  const decision: EngineDecision = decideEngine({ health, used, cap, now: now.getTime() });
  return { health, used, cap, decision };
}

/** The latest engine events (down, back up, cap warnings) for the settings page. */
export async function recentEngineEvents(companyId: string, take = 8) {
  const rows = await prisma.auditLog.findMany({
    where: { companyId, action: { in: [DOWN, UP, CAP] } },
    orderBy: { createdAt: "desc" },
    take,
    select: { action: true, createdAt: true, entityId: true, after: true },
  });
  return rows.map((r) => ({
    at: r.createdAt,
    kind:
      r.action === UP
        ? ("up" as const)
        : r.action === DOWN
          ? (((r.after as { reason?: string } | null)?.reason === "key" ? "down-key" : "down-credit") as "down-key" | "down-credit")
          : r.entityId === "100"
            ? ("cap-100" as const)
            : ("cap-80" as const),
  }));
}

/**
 * Reserves one question BEFORE the model is called, so questions that run side by side cannot all slip under the cap
 * and a question that fails after paid steps is still counted. The row is the one the monthly meter counts.
 * Returns null when the month's cap is already used up (the row is taken back).
 */
export async function reserveChat(companyId: string, userId: string, cap: number | null): Promise<{ id: string; usedBefore: number } | null> {
  const mine = await prisma.auditLog.create({ data: { companyId, actorUserId: userId, action: CHAT, entity: "AiChat" }, select: { id: true } });
  const used = await getUsage(companyId);
  if (cap !== null && used > cap) {
    await prisma.auditLog.delete({ where: { id: mine.id } }).catch(() => undefined);
    return null;
  }
  return { id: mine.id, usedBefore: used - 1 };
}

/**
 * The form and criteria designers also call the AI service, so they count against the same monthly cap and show in
 * the meter. Throws (429, plain Thai) when the cap is used up; the caller gives the slot back if the service refuses the call.
 */
export async function reserveDesignerCall(companyId: string, userId: string) {
  const cap = monthlyCap();
  const slot = await reserveChat(companyId, userId, cap);
  if (!slot) throw new AppError("RATE_LIMITED", 429, FALLBACK_REPLY.cap);
  return { ...slot, cap };
}

/** The reserved question never reached the service (key or credit refused it): it cost nothing, so it is not counted. */
export async function releaseChat(id: string) {
  await prisma.auditLog.delete({ where: { id } }).catch(() => undefined);
}

/** Warns the administrators at 80% and 100% once a reserved question has been counted. */
export async function noteChatUsage(companyId: string, usedBefore: number, cap: number | null) {
  const level = capLevel(usedBefore + 1, cap);
  if (level === 0) return;
  const since = monthStartBangkok(new Date());
  const already = await prisma.auditLog.count({ where: { companyId, action: CAP, createdAt: { gte: since }, entityId: String(level) } });
  if (already > 0) return;
  const mine = await prisma.auditLog.create({
    data: { companyId, action: CAP, entity: "AiCap", entityId: String(level), after: { used: usedBefore + 1, cap } },
    select: { id: true },
  });
  // Two answers can cross the line together; only the earliest row sends the notice.
  const first = await prisma.auditLog.findFirst({
    where: { companyId, action: CAP, createdAt: { gte: since }, entityId: String(level) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (first?.id !== mine.id) return;
  const n = level === 100 ? ENGINE_NOTICE.cap100 : ENGINE_NOTICE.cap80;
  await notifyPermissionHolders(companyId, NOTICE_PERMISSION, null, { ...n, category: "system", link: SETTINGS_LINK });
}

/** The service failed for a lasting reason: remember it (so the fallback answers) and tell the administrators once. */
export async function markDown(companyId: string, reason: "credit" | "key", before: EngineHealth) {
  const mine = await prisma.auditLog.create({ data: { companyId, action: DOWN, entity: "AiEngine", after: { reason } }, select: { id: true } });
  if (before.state === "down") return;
  // Requests that fail together all see "ok" above; only the earliest down row since the last recovery sends the notice.
  const lastUp = await prisma.auditLog.findFirst({ where: { companyId, action: UP }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const first = await prisma.auditLog.findFirst({
    where: { companyId, action: DOWN, createdAt: { gte: lastUp?.createdAt ?? new Date(Date.now() - STATE_MEMORY_MS) } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (first?.id !== mine.id) return;
  const n = reason === "credit" ? ENGINE_NOTICE.downCredit : ENGINE_NOTICE.downKey;
  await notifyPermissionHolders(companyId, NOTICE_PERMISSION, null, { ...n, category: "system", link: SETTINGS_LINK });
}

/** A question was answered by the service again after it was down: say so once. */
export async function markUp(companyId: string, before: EngineHealth) {
  if (before.state !== "down") return;
  const mine = await prisma.auditLog.create({ data: { companyId, action: UP, entity: "AiEngine" }, select: { id: true } });
  const lastDown = await prisma.auditLog.findFirst({ where: { companyId, action: DOWN }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const first = await prisma.auditLog.findFirst({
    where: { companyId, action: UP, ...(lastDown ? { createdAt: { gte: lastDown.createdAt } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (first?.id !== mine.id) return;
  await notifyPermissionHolders(companyId, NOTICE_PERMISSION, null, { ...ENGINE_NOTICE.up, category: "system", link: SETTINGS_LINK });
}
