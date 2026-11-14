import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, canAny } from "@/lib/auth/rbac";
import { signAiProposalToken, type AccessClaims } from "@/lib/auth/jwt";
import { writeAudit } from "@/lib/audit";
import { displayName } from "@/lib/format";
import { PROPOSAL_TOOL_RESULT, type ConfirmOutcome, type ProposalCard, type ProposalPayload } from "@/features/ai/proposal";
import {
  APPROVE_SKIP_REASON as WHY,
  buildApproveCard,
  checkApproveInput,
  correctionEffect,
  insufficientReason,
  leaveWhen,
  remainingEffect,
  stoppedText,
  thaiDay,
  type ApproveRef,
  type ApproveRow,
} from "@/features/ai/approve-proposal";
import { PAID_LEAVE_TYPES } from "@/features/leave/days";
import { LEAVE_LABEL } from "@/features/ai/read-summary";
import { decideLeave, getRemainingBalance, getRemainingHourBalance } from "@/features/leave/service";
import { decideAttendanceCorrection } from "@/features/attendance-correction/service";

type Meta = { ip?: string; userAgent?: string };

const day = (d: Date) => d.toISOString().slice(0, 10);
const isPaidType = (t: string) => (PAID_LEAVE_TYPES as readonly string[]).includes(t);

/** Who may decide a request: the requester's manager, or an HR-level approver (same rule as the decide pages). */
function mayDecide(session: AccessClaims, kind: ApproveRef["kind"], managerId: string | null): boolean {
  const hr = can(session.perms, kind === "leave" ? "leave:approve" : "attendance:approve");
  return hr || (!!session.employeeId && managerId === session.employeeId);
}

function hasKindPermission(session: AccessClaims, kind: ApproveRef["kind"]): boolean {
  return kind === "leave" ? canAny(session.perms, ["leave:approve", "leave:manage"]) : canAny(session.perms, ["attendance:approve", "attendance:manage"]);
}

type Inspected = { ok: true; row: ApproveRow; label: string; approvedByMe: boolean } | { ok: false; label: string; reason: string };

/**
 * Reads one request and says whether the assistant may approve it for this person right now,
 * with the card row if so. `running` carries each person's remaining leave through the batch,
 * so two requests from one person are checked against what is left after the first.
 */
async function inspectOne(
  session: AccessClaims,
  scopeWhere: Prisma.EmployeeWhereInput | undefined,
  ref: ApproveRef,
  running: Map<string, number>,
  since?: Date,
): Promise<Inspected> {
  const companyId = session.companyId;
  const short = ref.id.slice(0, 8);
  if (!hasKindPermission(session, ref.kind)) return { ok: false, label: `คำขอ ${short}`, reason: WHY.noPermission };

  if (ref.kind === "leave") {
    const r = await prisma.leaveRequest.findFirst({
      where: { id: ref.id, companyId, deletedAt: null },
      select: {
        id: true, employeeId: true, type: true, days: true, halfDay: true, halfDayPeriod: true, unit: true, hours: true,
        startTime: true, endTime: true, status: true, startDate: true, endDate: true, approverUserId: true, decidedAt: true,
        employee: { select: { managerId: true, firstName: true, lastName: true, nickname: true } },
      },
    });
    if (!r) return { ok: false, label: `คำขอลา ${short}`, reason: WHY.notFound };
    const person = displayName(r.employee);
    const typeLabel = LEAVE_LABEL[r.type] ?? r.type;
    const label = `${typeLabel}ของ ${person}`;
    const approvedByMe = r.status === "APPROVED" && r.approverUserId === session.sub && !!since && !!r.decidedAt && r.decidedAt >= since;
    if (approvedByMe) return { ok: true, label, approvedByMe: true, row: { ref, typeLabel, person, when: "", effect: "" } };
    if (r.status !== "PENDING") return { ok: false, label, reason: WHY.notPending };
    if (r.employeeId === session.employeeId) return { ok: false, label, reason: WHY.own };
    if (!mayDecide(session, "leave", r.employee.managerId)) return { ok: false, label, reason: WHY.notTeam };
    const inScope = await prisma.employee.count({ where: { id: r.employeeId, companyId, deletedAt: null, AND: [scopeWhere ?? {}] } });
    if (inScope === 0) return { ok: false, label, reason: WHY.outOfScope };
    if (!isPaidType(r.type)) return { ok: false, label, reason: WHY.notQuotaLeave };

    const year = r.startDate.getUTCFullYear();
    const hourly = r.unit === "HOUR";
    const key = `${r.employeeId}|${r.type}|${year}|${hourly ? "h" : "d"}`;
    const remaining = running.get(key) ?? (hourly ? await getRemainingHourBalance(companyId, r.employeeId, r.type, year) : await getRemainingBalance(companyId, r.employeeId, r.type, year));
    const asked = hourly ? r.hours ?? 0 : r.days;
    const unit = hourly ? "ชม." : "วัน";
    if (asked > remaining) return { ok: false, label, reason: insufficientReason(remaining, asked, unit) };
    running.set(key, remaining - asked);
    return {
      ok: true,
      label,
      approvedByMe: false,
      row: {
        ref,
        typeLabel,
        person,
        when: leaveWhen({ startDate: day(r.startDate), endDate: day(r.endDate), days: r.days, halfDay: r.halfDay, halfDayPeriod: r.halfDayPeriod, unit: r.unit, hours: r.hours, startTime: r.startTime, endTime: r.endTime }),
        effect: remainingEffect(remaining, asked, unit),
      },
    };
  }

  const r = await prisma.attendanceCorrectionRequest.findFirst({
    where: { id: ref.id, companyId, deletedAt: null },
    select: {
      id: true, employeeId: true, workDate: true, requestedClockIn: true, requestedClockOut: true, status: true, approverUserId: true, decidedAt: true,
      employee: { select: { managerId: true, firstName: true, lastName: true, nickname: true } },
    },
  });
  if (!r) return { ok: false, label: `คำขอแก้เวลา ${short}`, reason: WHY.notFound };
  const person = displayName(r.employee);
  const label = `ขอแก้เวลาของ ${person}`;
  const approvedByMe = r.status === "APPROVED" && r.approverUserId === session.sub && !!since && !!r.decidedAt && r.decidedAt >= since;
  if (approvedByMe) return { ok: true, label, approvedByMe: true, row: { ref, typeLabel: "ขอแก้เวลา", person, when: "", effect: "" } };
  if (r.status !== "PENDING") return { ok: false, label, reason: WHY.notPending };
  if (r.employeeId === session.employeeId) return { ok: false, label, reason: WHY.own };
  if (!mayDecide(session, "correction", r.employee.managerId)) return { ok: false, label, reason: WHY.notTeam };
  const inScope = await prisma.employee.count({ where: { id: r.employeeId, companyId, deletedAt: null, AND: [scopeWhere ?? {}] } });
  if (inScope === 0) return { ok: false, label, reason: WHY.outOfScope };
  return {
    ok: true,
    label,
    approvedByMe: false,
    row: { ref, typeLabel: "ขอแก้เวลา", person, when: thaiDay(day(r.workDate)), effect: correctionEffect(r.requestedClockIn, r.requestedClockOut) },
  };
}

/** Draws the card for approve_requests. Nothing is approved here. */
export async function prepareApproveProposal(
  session: AccessClaims,
  raw: Record<string, unknown>,
  scopeWhere?: Prisma.EmployeeWhereInput,
): Promise<{ card: ProposalCard | null; message: string }> {
  const input = checkApproveInput(raw.requests);
  if (!input.ok) return { card: null, message: input.message };

  const rows: ApproveRow[] = [];
  const skipped: string[] = [];
  const running = new Map<string, number>();
  // Sequential: the pooled connection serves one query at a time.
  for (const ref of input.items) {
    const r = await inspectOne(session, scopeWhere, ref, running);
    if (r.ok) rows.push(r.row);
    else skipped.push(`${r.label}: ${r.reason}`);
  }
  if (rows.length === 0) {
    return { card: null, message: `ไม่มีคำขอไหนที่น้องวีบอทอนุมัติให้ได้ ให้บอกผู้ใช้ตามเหตุผลนี้ ไม่ต้องออกการ์ด: ${skipped.join("; ")}` };
  }

  const payload: ProposalPayload = {
    kind: "approve_requests",
    title: `อนุมัติ ${rows.length} รายการ`,
    body: "",
    count: rows.length,
    approve: { items: rows.map((r) => r.ref) },
  };
  const token = await signAiProposalToken(session.sub, session.companyId, payload as unknown as Record<string, unknown>);
  return { card: buildApproveCard(token, rows, skipped), message: PROPOSAL_TOOL_RESULT };
}

/**
 * Approves a confirmed card one request at a time through the same decide functions the pages use
 * (so the balance, manager and self-approval rules all apply), and stops at the first request that
 * cannot be approved. Requests already approved by an earlier press of this card are counted, not redone.
 */
export async function confirmApproveProposal(
  session: AccessClaims,
  p: ProposalPayload,
  scopeWhere: Prisma.EmployeeWhereInput | undefined,
  since: Date,
  meta?: Meta,
): Promise<ConfirmOutcome> {
  const items = p.approve?.items ?? [];
  if (items.length === 0 || items.length > 20) return { status: "refused", message: "การ์ดไม่ถูกต้อง ให้น้องวีบอทเตรียมใหม่" };

  const running = new Map<string, number>();
  const approved: ApproveRef[] = [];
  let alreadyBefore = 0;
  for (let i = 0; i < items.length; i++) {
    const ref = items[i];
    const r = await inspectOne(session, scopeWhere, ref, running, since);
    if (!r.ok) return { status: "refused", message: stoppedText(approved.length + alreadyBefore, items.length, i + 1, r.label, r.reason) };
    if (r.approvedByMe) {
      alreadyBefore++;
      continue;
    }
    try {
      if (ref.kind === "leave") await decideLeave(session.companyId, session, ref.id, { action: "approve" }, meta);
      else await decideAttendanceCorrection(session.companyId, session, ref.id, { action: "approve" }, meta);
      approved.push(ref);
    } catch (e) {
      return { status: "refused", message: stoppedText(approved.length + alreadyBefore, items.length, i + 1, r.label, e instanceof Error ? e.message : "เกิดข้อผิดพลาด") };
    }
  }

  if (approved.length === 0) return { status: "already", message: `อนุมัติไปแล้วก่อนหน้านี้ ${alreadyBefore} รายการ ไม่ได้อนุมัติซ้ำ` };

  // Read back: every request on the card should now be approved.
  const leaveIds = items.filter((x) => x.kind === "leave").map((x) => x.id);
  const corrIds = items.filter((x) => x.kind === "correction").map((x) => x.id);
  const okLeave = leaveIds.length ? await prisma.leaveRequest.count({ where: { id: { in: leaveIds }, companyId: session.companyId, status: "APPROVED" } }) : 0;
  const okCorr = corrIds.length ? await prisma.attendanceCorrectionRequest.count({ where: { id: { in: corrIds }, companyId: session.companyId, status: "APPROVED" } }) : 0;
  await writeAudit({
    companyId: session.companyId,
    actorUserId: session.sub,
    action: "ai.approve_requests",
    entity: "ApprovalBatch",
    after: { approvedNow: approved, alreadyBefore, readBack: okLeave + okCorr, total: items.length },
    ...meta,
  });
  if (okLeave + okCorr !== items.length) {
    return { status: "refused", message: `อนุมัติแล้ว แต่ตรวจย้อนพบว่ามีเพียง ${okLeave + okCorr} จาก ${items.length} รายการที่เป็นอนุมัติ แจ้ง HR ให้ตรวจ` };
  }
  return { status: "done", message: `อนุมัติแล้ว ${items.length} รายการ` };
}
