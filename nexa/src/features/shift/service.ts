import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { ShiftAssignment } from "./types";
import type {
  TemplateCreateInput,
  TemplateUpdateInput,
  AssignmentUpsertInput,
  SwapRequestCreateInput,
  SwapRequestDecideInput,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

/** HR-level approvers (wildcard shift permission) may act on any swap request. */
function isHrLevel(session: AccessClaims): boolean {
  return session.perms.includes("*") || session.perms.includes("shift:approve");
}

const templateSelect = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  color: true,
  breakMinutes: true,
} satisfies Prisma.ShiftTemplateSelect;

export async function listTemplates(companyId: string) {
  return prisma.shiftTemplate.findMany({
    where: { companyId, deletedAt: null },
    select: templateSelect,
    orderBy: { startTime: "asc" },
  });
}

export async function getTemplate(companyId: string, id: string) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: templateSelect,
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  return tpl;
}

export async function createTemplate(
  companyId: string,
  session: AccessClaims,
  input: TemplateCreateInput,
  meta?: Meta,
) {
  const record = await prisma.shiftTemplate.create({
    data: {
      companyId,
      name: input.name,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color,
      breakMinutes: input.breakMinutes,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: templateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.create",
    entity: "ShiftTemplate",
    entityId: record.id,
    ...meta,
  });
  return record;
}

export async function updateTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: TemplateUpdateInput,
  meta?: Meta,
) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  const record = await prisma.shiftTemplate.update({
    where: { id: tpl.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.breakMinutes !== undefined ? { breakMinutes: input.breakMinutes } : {}),
      updatedById: session.sub,
    },
    select: templateSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.update",
    entity: "ShiftTemplate",
    entityId: tpl.id,
    ...meta,
  });
  return record;
}

export async function deleteTemplate(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const tpl = await prisma.shiftTemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!tpl) throw NotFound("ไม่พบกะการทำงาน");
  // Remove assignments then soft-delete the template.
  await prisma.shiftAssignment.deleteMany({ where: { companyId, templateId: tpl.id } });
  await prisma.shiftTemplate.update({
    where: { id: tpl.id },
    data: { deletedAt: new Date(), updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.template.delete",
    entity: "ShiftTemplate",
    entityId: tpl.id,
    ...meta,
  });
  return { ok: true as const };
}

export async function listAssignments(
  companyId: string,
  from: string,
  to: string,
): Promise<ShiftAssignment[]> {
  const rows = await prisma.shiftAssignment.findMany({
    where: {
      companyId,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    select: {
      id: true,
      date: true,
      employeeId: true,
      note: true,
      template: {
        select: { id: true, name: true, startTime: true, endTime: true, color: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    employeeId: r.employeeId,
    note: r.note,
    template: r.template,
  }));
}

/** Self-scoped schedule — a dedicated function so the existing company-wide
 * `listAssignments` (used by the roster grid) is untouched. */
export async function listMyAssignments(
  companyId: string,
  employeeId: string,
  from: string,
  to: string,
): Promise<ShiftAssignment[]> {
  const rows = await prisma.shiftAssignment.findMany({
    where: {
      companyId,
      employeeId,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    select: {
      id: true,
      date: true,
      employeeId: true,
      note: true,
      template: {
        select: { id: true, name: true, startTime: true, endTime: true, color: true },
      },
    },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    employeeId: r.employeeId,
    note: r.note,
    template: r.template,
  }));
}

export async function upsertAssignment(
  companyId: string,
  session: AccessClaims,
  input: AssignmentUpsertInput,
  meta?: Meta,
) {
  // Sequential, not Promise.all — connection_limit=1.
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  const template = await prisma.shiftTemplate.findFirst({
    where: { id: input.templateId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw BadRequest("ไม่พบพนักงาน");
  if (!template) throw BadRequest("ไม่พบกะการทำงาน");

  const record = await prisma.shiftAssignment.upsert({
    where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
    create: {
      companyId,
      employeeId: input.employeeId,
      templateId: input.templateId,
      date: input.date,
      note: input.note,
      createdById: session.sub,
      updatedById: session.sub,
    },
    update: {
      templateId: input.templateId,
      note: input.note,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.assign",
    entity: "ShiftAssignment",
    entityId: record.id,
    ...meta,
  });
  return record;
}

export async function deleteAssignment(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const asg = await prisma.shiftAssignment.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!asg) throw NotFound("ไม่พบเวรที่มอบหมาย");
  await prisma.shiftAssignment.delete({ where: { id: asg.id } });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.unassign",
    entity: "ShiftAssignment",
    entityId: asg.id,
    ...meta,
  });
  return { ok: true as const };
}

const swapRequestSelect = {
  id: true,
  status: true,
  reason: true,
  decidedAt: true,
  decisionNote: true,
  createdAt: true,
  assignment: {
    select: {
      id: true,
      date: true,
      template: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
    },
  },
  requesterEmployee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
  targetEmployee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
  },
} satisfies Prisma.ShiftSwapRequestSelect;

/**
 * One-directional coverage request: give my assigned shift to a coworker.
 * Not a bilateral swap — the target doesn't have to give anything back.
 */
export async function createSwapRequest(
  companyId: string,
  session: AccessClaims,
  input: SwapRequestCreateInput,
  meta?: Meta,
) {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  if (input.targetEmployeeId === session.employeeId) {
    throw BadRequest("กรุณาเลือกเพื่อนร่วมงานคนอื่น");
  }

  const assignment = await prisma.shiftAssignment.findFirst({
    where: { id: input.assignmentId, companyId },
    select: { id: true, employeeId: true },
  });
  if (!assignment) throw NotFound("ไม่พบเวรที่มอบหมาย");
  if (assignment.employeeId !== session.employeeId) {
    throw Forbidden("ขอสลับได้เฉพาะเวรของตนเอง");
  }

  const target = await prisma.employee.findFirst({
    where: { id: input.targetEmployeeId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw BadRequest("ไม่พบพนักงานที่เลือก");

  const record = await prisma.shiftSwapRequest.create({
    data: {
      companyId,
      assignmentId: assignment.id,
      requesterEmployeeId: session.employeeId,
      targetEmployeeId: input.targetEmployeeId,
      reason: input.reason,
      status: "PENDING",
    },
    select: swapRequestSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.swap.create",
    entity: "ShiftSwapRequest",
    entityId: record.id,
    ...meta,
  });

  return record;
}

export async function listSwapRequests(
  companyId: string,
  session: AccessClaims,
  scope: "mine" | "inbox",
) {
  if (scope === "mine") {
    if (!session.employeeId) return [];
    return prisma.shiftSwapRequest.findMany({
      where: { companyId, requesterEmployeeId: session.employeeId },
      select: swapRequestSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  // inbox: requests awaiting a decision from me — either I manage the
  // requester, or I hold company-wide shift:approve.
  const rows = await prisma.shiftSwapRequest.findMany({
    where: { companyId, status: "PENDING" },
    select: { ...swapRequestSelect, requesterEmployee: { select: { ...swapRequestSelect.requesterEmployee.select, managerId: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (isHrLevel(session)) return rows;
  return rows.filter((r) => r.requesterEmployee.managerId === session.employeeId);
}

export async function decideSwapRequest(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: SwapRequestDecideInput,
  meta?: Meta,
) {
  const req = await prisma.shiftSwapRequest.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      status: true,
      assignmentId: true,
      targetEmployeeId: true,
      requesterEmployeeId: true,
      assignment: { select: { date: true } },
      requesterEmployee: { select: { managerId: true } },
    },
  });
  if (!req) throw NotFound("ไม่พบคำขอสลับเวร");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (req.requesterEmployeeId === session.employeeId) {
    throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");
  }
  const isManager = req.requesterEmployee.managerId === session.employeeId;
  if (!isManager && !isHrLevel(session)) {
    throw Forbidden("อนุมัติได้เฉพาะคำขอของทีมที่คุณดูแล");
  }

  const nextStatus = input.action === "approve" ? "APPROVED" : "REJECTED";

  const updated = await prisma.$transaction(async (tx) => {
    // Compare-and-swap on status FIRST, before any side effect — two
    // concurrent decisions (double-click, retry) both read status "PENDING"
    // before either write lands. Guarding this write on the status they read
    // means only the first actually applies; the second sees count 0 and
    // fails loudly before ever touching the shift assignment, instead of
    // both racing to reassign the same slot.
    const { count } = await tx.shiftSwapRequest.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: {
        status: nextStatus,
        approverEmployeeId: session.employeeId ?? null,
        approverUserId: session.sub,
        decidedAt: new Date(),
        decisionNote: input.note,
      },
    });
    if (count === 0) throw Conflict("คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");

    if (input.action === "approve") {
      // The target may already have their own assignment that day — the
      // unique (employeeId, date) constraint would reject the reassignment.
      const clash = await tx.shiftAssignment.findUnique({
        where: { employeeId_date: { employeeId: req.targetEmployeeId, date: req.assignment.date } },
        select: { id: true },
      });
      if (clash) throw BadRequest("พนักงานที่เลือกมีเวรอยู่แล้วในวันนั้น");

      await tx.shiftAssignment.update({
        where: { id: req.assignmentId },
        data: { employeeId: req.targetEmployeeId, updatedById: session.sub },
      });
    }

    return tx.shiftSwapRequest.findFirstOrThrow({
      where: { id: req.id },
      select: swapRequestSelect,
    });
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `shift.swap.${input.action}`,
    entity: "ShiftSwapRequest",
    entityId: req.id,
    after: { status: nextStatus },
    ...meta,
  });

  return updated;
}

export async function cancelSwapRequest(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const req = await prisma.shiftSwapRequest.findFirst({
    where: { id, companyId },
    select: { id: true, requesterEmployeeId: true, status: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอสลับเวร");
  if (req.requesterEmployeeId !== session.employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ยกเลิกไม่ได้");

  const updated = await prisma.shiftSwapRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED" },
    select: swapRequestSelect,
  });

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "shift.swap.cancel",
    entity: "ShiftSwapRequest",
    entityId: req.id,
    ...meta,
  });

  return updated;
}
