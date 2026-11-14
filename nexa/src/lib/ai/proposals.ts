import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { employeeNameFilter } from "@/lib/ai/scope";
import { can } from "@/lib/auth/rbac";
import { signAiProposalToken, verifyAiProposalToken, type AccessClaims } from "@/lib/auth/jwt";
import { writeAudit } from "@/lib/audit";
import { displayName } from "@/lib/format";
import { createAnnouncement } from "@/features/announcement/service";
import { confirmShiftProposal, prepareShiftProposal } from "@/lib/ai/shift-proposal";
import { confirmApproveProposal, prepareApproveProposal } from "@/lib/ai/approve-proposal";
import { confirmTemplateProposal, prepareTemplateProposal } from "@/lib/ai/template-proposal";
import { confirmQuotaProposal, prepareQuotaProposal } from "@/lib/ai/quota-proposal";
import { shouldPushToLine } from "@/features/notification/line-policy";
import {
  buildAnnouncementCard,
  buildNotificationCard,
  checkProposalInput,
  isAllTarget,
  PROPOSAL_KINDS,
  PROPOSAL_TOOL_RESULT,
  type ConfirmOutcome,
  type ProposalCard,
  type ProposalKind,
  type ProposalPayload,
} from "@/features/ai/proposal";

type Meta = { ip?: string; userAgent?: string };

/** One permission per kind; approve_requests checks leave and attendance approval itself, per request. */
const NEED_PERM: Record<Exclude<ProposalKind, "approve_requests">, string> = {
  draft_evaluation_template: "campaign:create",
  adjust_leave_quota: "employee:update",
  send_notification: "notification:create",
  create_announcement: "announcement:create",
  assign_shifts: "shift:create",
};

/** Everyone an announcement reaches, the same rule the publisher uses (features/announcement/service.ts). */
const announcementAudience = (companyId: string): Prisma.EmployeeWhereInput => ({
  companyId,
  deletedAt: null,
  status: { in: ["ACTIVE", "ON_LEAVE"] },
});

/** Who a notification reaches: every active person in the sender's AI scope, or the people matching a name or code. */
async function resolveRecipients(companyId: string, target: string, scopeWhere?: Prisma.EmployeeWhereInput) {
  const select = { id: true, firstName: true, lastName: true, nickname: true } as const;
  if (isAllTarget(target)) {
    return prisma.employee.findMany({
      where: { companyId, deletedAt: null, status: "ACTIVE", AND: [scopeWhere ?? {}] },
      select,
    });
  }
  return prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      // AND, not spread: scopeWhere may itself be an `OR` filter (TEAM scope).
      AND: [
        scopeWhere ?? {},
        employeeNameFilter(target),
      ],
    },
    select,
    take: 50,
  });
}

/**
 * Draws a confirmation card for a write the model asked for. Nothing is sent or
 * saved here. Returns the card (to show the person) and the text the model sees.
 */
export async function prepareProposal(
  session: AccessClaims,
  kind: ProposalKind,
  rawInput: Record<string, unknown>,
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<{ card: ProposalCard | null; message: string }> {
  if (kind === "approve_requests") return prepareApproveProposal(session, rawInput, scopeWhere);
  const need = NEED_PERM[kind];
  if (!can(session.perms, need)) {
    return { card: null, message: `ไม่ได้รับอนุญาต: ต้องมีสิทธิ์ ${need} จึงจะใช้เครื่องมือนี้ได้` };
  }
  if (kind === "assign_shifts") return prepareShiftProposal(session, rawInput, scopeWhere);
  if (kind === "draft_evaluation_template") return prepareTemplateProposal(session, rawInput);
  if (kind === "adjust_leave_quota") return prepareQuotaProposal(session, rawInput, scopeWhere);
  const input = checkProposalInput(kind, rawInput);
  if (!input.ok) return { card: null, message: input.message };
  const companyId = session.companyId;

  if (kind === "send_notification") {
    const recipients = await resolveRecipients(companyId, input.target ?? "", scopeWhere);
    if (recipients.length === 0) return { card: null, message: "ไม่พบพนักงานปลายทาง ให้ถามผู้ใช้ว่าจะส่งถึงใคร" };
    const payload: ProposalPayload = { kind, title: input.title, body: input.body, target: input.target, count: recipients.length };
    const token = await signAiProposalToken(session.sub, companyId, payload as unknown as Record<string, unknown>);
    const card = buildNotificationCard(token, input, {
      count: recipients.length,
      names: recipients.map((r) => displayName(r)),
      isAll: isAllTarget(input.target),
    });
    return { card, message: PROPOSAL_TOOL_RESULT };
  }

  const audience = await prisma.employee.count({ where: announcementAudience(companyId) });
  const me = session.employeeId
    ? await prisma.employee.findFirst({
        where: { id: session.employeeId, companyId },
        select: { firstName: true, lastName: true, nickname: true },
      })
    : null;
  const payload: ProposalPayload = { kind, title: input.title, body: input.body, count: audience };
  const token = await signAiProposalToken(session.sub, companyId, payload as unknown as Record<string, unknown>);
  return { card: buildAnnouncementCard(token, input, me ? displayName(me) : "คุณ", audience), message: PROPOSAL_TOOL_RESULT };
}

function readPayload(raw: Record<string, unknown>): ProposalPayload | null {
  const kind = raw.kind;
  if (typeof kind !== "string" || !(PROPOSAL_KINDS as readonly string[]).includes(kind)) return null;
  if (typeof raw.title !== "string" || typeof raw.body !== "string") return null;
  const sh = raw.shift as Record<string, unknown> | undefined;
  const shift =
    sh && typeof sh.templateId === "string" && Array.isArray(sh.employeeIds) && Array.isArray(sh.dates) && typeof sh.changing === "number" && typeof sh.replaced === "number"
      ? {
          templateId: sh.templateId,
          employeeIds: sh.employeeIds.filter((x): x is string => typeof x === "string"),
          dates: sh.dates.filter((x): x is string => typeof x === "string"),
          changing: sh.changing,
          replaced: sh.replaced,
        }
      : undefined;
  const ap = raw.approve as Record<string, unknown> | undefined;
  const approve =
    ap && Array.isArray(ap.items)
      ? {
          items: (ap.items as unknown[]).flatMap((x) => {
            const o = (x ?? {}) as Record<string, unknown>;
            return (o.kind === "leave" || o.kind === "correction") && typeof o.id === "string" ? [{ kind: o.kind as "leave" | "correction", id: o.id }] : [];
          }),
        }
      : undefined;
  return {
    kind: kind as ProposalKind,
    title: raw.title,
    body: raw.body,
    target: typeof raw.target === "string" ? raw.target : undefined,
    count: typeof raw.count === "number" ? raw.count : undefined,
    shift,
    approve,
    quota: (() => {
      const qo = raw.quota as Record<string, unknown> | undefined;
      if (!qo || typeof qo.year !== "number" || !Array.isArray(qo.items)) return undefined;
      const items = (qo.items as unknown[]).flatMap((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const okType = o.type === "ANNUAL" || o.type === "SICK" || o.type === "PERSONAL";
        return okType && typeof o.employeeId === "string" && typeof o.before === "number" && typeof o.after === "number"
          ? [{ employeeId: o.employeeId, type: o.type as "ANNUAL" | "SICK" | "PERSONAL", before: o.before, after: o.after }]
          : [];
      });
      return { year: qo.year, items };
    })(),
    template: raw.template && typeof raw.template === "object" ? (raw.template as Record<string, unknown>) : undefined,
  };
}

/**
 * Runs a confirmed card under the signed-in person's own session. Order: verify
 * the token (signature, expiry, same person and company), re-check permission and
 * that the audience is unchanged, skip if an earlier press already did it, write,
 * read back, audit. A refusal is returned as text for the card, never thrown.
 */
export async function confirmProposal(
  session: AccessClaims,
  token: string,
  scopeWhere: Prisma.EmployeeWhereInput | undefined,
  meta?: Meta,
): Promise<ConfirmOutcome> {
  const verified = await verifyAiProposalToken(token);
  if (!verified) return { status: "refused", message: "การ์ดหมดอายุแล้ว ให้น้องวีบอทเตรียมใหม่" };
  if (verified.sub !== session.sub || verified.companyId !== session.companyId) {
    return { status: "refused", message: "การ์ดนี้ไม่ได้เตรียมไว้ให้บัญชีนี้" };
  }
  const p = readPayload(verified.payload);
  if (!p) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };

  if (p.kind === "approve_requests") return confirmApproveProposal(session, p, scopeWhere, new Date(verified.iat * 1000), meta);
  const need = NEED_PERM[p.kind];
  if (!can(session.perms, need)) return { status: "refused", message: `ไม่มีสิทธิ์ทำรายการนี้ (ต้องมี ${need}) ยังไม่มีอะไรถูกส่ง` };

  const companyId = session.companyId;
  const since = new Date(verified.iat * 1000);

  if (p.kind === "assign_shifts") return confirmShiftProposal(session, p, scopeWhere, meta);
  if (p.kind === "draft_evaluation_template") return confirmTemplateProposal(session, p, since, meta);
  if (p.kind === "adjust_leave_quota") return confirmQuotaProposal(session, p, scopeWhere, meta);

  if (p.kind === "send_notification") {
    const already = await prisma.notification.count({
      where: { companyId, createdById: session.sub, category: "ai", title: p.title, body: p.body, createdAt: { gte: since } },
    });
    if (already > 0) return { status: "already", message: `ส่งไปแล้วก่อนหน้านี้ ถึง ${already} คน ไม่ได้ส่งซ้ำ` };

    const recipients = await resolveRecipients(companyId, p.target ?? "", scopeWhere);
    if (recipients.length === 0) return { status: "refused", message: "ไม่พบผู้รับแล้ว ยังไม่มีอะไรถูกส่ง" };
    if (recipients.length !== p.count) {
      return {
        status: "refused",
        message: `จำนวนผู้รับเปลี่ยนจาก ${p.count ?? 0} เป็น ${recipients.length} คน ยังไม่มีอะไรถูกส่ง ให้น้องวีบอทเตรียมใหม่`,
      };
    }
    // The `ai` category stays in the app; if the LINE policy ever lists it, this card must be redrawn to say so.
    if (shouldPushToLine("ai")) return { status: "refused", message: "นโยบาย LINE เปลี่ยนไป ยังไม่มีอะไรถูกส่ง ให้น้องวีบอทเตรียมใหม่" };

    // One createMany, like announcements: the pooled connection serves one query at a time.
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        companyId,
        employeeId: r.id,
        title: p.title,
        body: p.body,
        category: "ai",
        createdById: session.sub,
      })),
    });
    const written = await prisma.notification.count({
      where: { companyId, createdById: session.sub, category: "ai", title: p.title, body: p.body, createdAt: { gte: since } },
    });
    await writeAudit({
      companyId,
      actorUserId: session.sub,
      action: "ai.send_notification",
      entity: "Notification",
      after: { title: p.title, target: p.target, recipients: recipients.length, written },
      ...meta,
    });
    if (written !== recipients.length) {
      return { status: "refused", message: `ส่งได้ ${written} จาก ${recipients.length} คน แจ้ง HR ให้ตรวจ` };
    }
    return { status: "done", message: `ส่งแจ้งเตือนแล้ว ถึง ${written} คน` };
  }

  // create_announcement
  const already = await prisma.announcement.count({
    where: { companyId, createdById: session.sub, title: p.title, body: p.body, deletedAt: null, createdAt: { gte: since } },
  });
  if (already > 0) return { status: "already", message: "เผยแพร่ไปแล้วก่อนหน้านี้ ไม่ได้เผยแพร่ซ้ำ" };

  const audience = await prisma.employee.count({ where: announcementAudience(companyId) });
  if (audience !== p.count) {
    return {
      status: "refused",
      message: `จำนวนผู้รับเปลี่ยนจาก ${p.count ?? 0} เป็น ${audience} คน ยังไม่ได้เผยแพร่ ให้น้องวีบอทเตรียมใหม่`,
    };
  }
  const rec = await createAnnouncement(companyId, session, { title: p.title, body: p.body, pinned: false, status: "PUBLISHED" }, meta);
  const back = await prisma.announcement.findFirst({ where: { id: rec.id, companyId, deletedAt: null }, select: { status: true } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "ai.create_announcement",
    entity: "Announcement",
    entityId: rec.id,
    after: { title: p.title, audience },
    ...meta,
  });
  if (back?.status !== "PUBLISHED") return { status: "refused", message: "บันทึกประกาศแล้วแต่ตรวจสถานะไม่ผ่าน แจ้ง HR ให้ตรวจ" };
  return { status: "done", message: `เผยแพร่ประกาศแล้ว ถึง ${audience} คน` };
}
