import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/lib/api/errors";
import { fullName, loginIdentifier } from "@/lib/format";
import type { AccessClaims } from "@/lib/auth/jwt";
import type { ApprovalWorkflow, ApprovalRequest, RequestStep, WorkflowStepDef } from "./types";
import type {
  WorkflowCreateInput,
  WorkflowUpdateInput,
  RequestCreateInput,
  RequestDecideInput,
  RequestListQuery,
} from "./schema";

type Meta = { ip?: string; userAgent?: string };

function requireEmployeeId(session: AccessClaims): string {
  if (!session.employeeId) throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
  return session.employeeId;
}

function asStepDefs(json: Prisma.JsonValue): WorkflowStepDef[] {
  return (json as unknown as WorkflowStepDef[]) ?? [];
}
function asReqSteps(json: Prisma.JsonValue): RequestStep[] {
  return (json as unknown as RequestStep[]) ?? [];
}

async function actorName(companyId: string, session: AccessClaims): Promise<string> {
  if (session.employeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: session.employeeId, companyId },
      select: { firstName: true, lastName: true },
    });
    if (emp) return fullName(emp.firstName, emp.lastName);
  }
  return loginIdentifier(session);
}

// ─────────── Workflow definitions ───────────

export async function listWorkflows(companyId: string, activeOnly = false): Promise<ApprovalWorkflow[]> {
  const rows = await prisma.approvalWorkflow.findMany({
    where: { companyId, deletedAt: null, ...(activeOnly ? { active: true } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    steps: asStepDefs(w.steps),
    active: w.active,
  }));
}

export async function getWorkflow(companyId: string, id: string): Promise<ApprovalWorkflow> {
  const w = await prisma.approvalWorkflow.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!w) throw NotFound("ไม่พบเวิร์กโฟลว์");
  return { id: w.id, name: w.name, description: w.description, steps: asStepDefs(w.steps), active: w.active };
}

export async function createWorkflow(
  companyId: string,
  session: AccessClaims,
  input: WorkflowCreateInput,
  meta?: Meta,
) {
  const steps = input.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ order: i, name: s.name, approverRole: s.approverRole }));
  const record = await prisma.approvalWorkflow.create({
    data: {
      companyId,
      name: input.name,
      description: input.description,
      steps: steps as unknown as Prisma.InputJsonValue,
      active: input.active,
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "workflow.create",
    entity: "ApprovalWorkflow",
    entityId: record.id,
    after: { name: input.name },
    ...meta,
  });
  return record;
}

export async function updateWorkflow(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: WorkflowUpdateInput,
  meta?: Meta,
) {
  const wf = await prisma.approvalWorkflow.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!wf) throw NotFound("ไม่พบเวิร์กโฟลว์");
  const steps = input.steps
    ? input.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({ order: i, name: s.name, approverRole: s.approverRole }))
    : undefined;
  const record = await prisma.approvalWorkflow.update({
    where: { id: wf.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(steps !== undefined ? { steps: steps as unknown as Prisma.InputJsonValue } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "workflow.update",
    entity: "ApprovalWorkflow",
    entityId: wf.id,
    ...meta,
  });
  return record;
}

export async function deleteWorkflow(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const wf = await prisma.approvalWorkflow.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!wf) throw NotFound("ไม่พบเวิร์กโฟลว์");
  await prisma.approvalWorkflow.update({
    where: { id: wf.id },
    data: { deletedAt: new Date(), active: false, updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "workflow.delete",
    entity: "ApprovalWorkflow",
    entityId: wf.id,
    ...meta,
  });
  return { ok: true as const };
}

// ─────────── Requests ───────────

function serializeRequest(r: {
  id: string;
  workflowName: string;
  requesterName: string;
  title: string;
  detail: string | null;
  amount: Prisma.Decimal | null;
  steps: Prisma.JsonValue;
  currentStep: number;
  status: string;
  createdAt: Date;
}): ApprovalRequest {
  return {
    id: r.id,
    workflowName: r.workflowName,
    requesterName: r.requesterName,
    title: r.title,
    detail: r.detail,
    amount: r.amount != null ? Number(r.amount) : null,
    steps: asReqSteps(r.steps),
    currentStep: r.currentStep,
    status: r.status as ApprovalRequest["status"],
    createdAt: r.createdAt.toISOString(),
  };
}

const requestSelect = {
  id: true,
  workflowName: true,
  requesterName: true,
  requesterEmployeeId: true,
  title: true,
  detail: true,
  amount: true,
  steps: true,
  currentStep: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ApprovalRequestSelect;

export async function listRequests(
  companyId: string,
  session: AccessClaims,
  query: RequestListQuery,
): Promise<ApprovalRequest[]> {
  if (query.scope === "me") {
    const employeeId = requireEmployeeId(session);
    const rows = await prisma.approvalRequest.findMany({
      where: { companyId, requesterEmployeeId: employeeId },
      select: requestSelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(serializeRequest);
  }

  if (query.scope === "inbox") {
    const rows = await prisma.approvalRequest.findMany({
      where: { companyId, status: "PENDING" },
      select: requestSelect,
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const roles = new Set(session.roles);
    return rows
      .filter((r) => {
        if (r.requesterEmployeeId === session.employeeId) return false;
        const steps = asReqSteps(r.steps);
        const step = steps[r.currentStep];
        return step ? roles.has(step.approverRole) : false;
      })
      .map(serializeRequest);
  }

  // all
  const rows = await prisma.approvalRequest.findMany({
    where: { companyId },
    select: requestSelect,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(serializeRequest);
}

export async function createRequest(
  companyId: string,
  session: AccessClaims,
  input: RequestCreateInput,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const wf = await prisma.approvalWorkflow.findFirst({
    where: { id: input.workflowId, companyId, deletedAt: null, active: true },
    select: { id: true, name: true, steps: true },
  });
  if (!wf) throw BadRequest("ไม่พบเวิร์กโฟลว์ หรือปิดใช้งานอยู่");

  const defs = asStepDefs(wf.steps);
  if (defs.length === 0) throw BadRequest("เวิร์กโฟลว์นี้ยังไม่มีขั้นอนุมัติ");
  const steps: RequestStep[] = defs.map((d) => ({
    order: d.order,
    name: d.name,
    approverRole: d.approverRole,
    status: "PENDING",
  }));

  const record = await prisma.approvalRequest.create({
    data: {
      companyId,
      workflowId: wf.id,
      workflowName: wf.name,
      requesterEmployeeId: employeeId,
      requesterName: await actorName(companyId, session),
      title: input.title,
      detail: input.detail,
      amount: input.amount != null ? new Prisma.Decimal(input.amount) : null,
      steps: steps as unknown as Prisma.InputJsonValue,
      currentStep: 0,
      status: "PENDING",
      createdById: session.sub,
      updatedById: session.sub,
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "workflow.request",
    entity: "ApprovalRequest",
    entityId: record.id,
    after: { title: input.title, workflow: wf.name },
    ...meta,
  });
  return record;
}

export async function decideRequest(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: RequestDecideInput,
  meta?: Meta,
) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      requesterEmployeeId: true,
      steps: true,
      currentStep: true,
      status: true,
    },
  });
  if (!req) throw NotFound("ไม่พบคำขอ");
  if (req.status !== "PENDING") throw BadRequest("คำขอนี้ถูกดำเนินการไปแล้ว");
  if (req.requesterEmployeeId === session.employeeId) {
    throw Forbidden("ไม่สามารถอนุมัติคำขอของตนเองได้");
  }

  const steps = asReqSteps(req.steps);
  const step = steps[req.currentStep];
  if (!step) throw BadRequest("ขั้นอนุมัติไม่ถูกต้อง");

  const isApprover = session.roles.includes(step.approverRole) || session.perms.includes("*");
  if (!isApprover) throw Forbidden(`อนุมัติได้เฉพาะผู้มีบทบาท “${step.approverRole}”`);

  const by = await actorName(companyId, session);
  const decidedAt = new Date().toISOString();

  let nextStatus = req.status;
  let nextStep = req.currentStep;

  if (input.action === "approve") {
    steps[req.currentStep] = { ...step, status: "APPROVED", decidedByName: by, decidedAt, note: input.note };
    if (req.currentStep >= steps.length - 1) {
      nextStatus = "APPROVED";
    } else {
      nextStep = req.currentStep + 1;
    }
  } else {
    steps[req.currentStep] = { ...step, status: "REJECTED", decidedByName: by, decidedAt, note: input.note };
    nextStatus = "REJECTED";
  }

  // Compare-and-swap on status: two concurrent decisions (double-click,
  // retry, or two approvers for the same step) both read status "PENDING"
  // before either write lands. Guarding the write on the status they read
  // means only the first one actually applies — the second sees count 0 and
  // fails loudly instead of silently overwriting the first decision's steps.
  const { count } = await prisma.approvalRequest.updateMany({
    where: { id: req.id, status: "PENDING" },
    data: {
      steps: steps as unknown as Prisma.InputJsonValue,
      currentStep: nextStep,
      status: nextStatus,
      updatedById: session.sub,
    },
  });
  if (count === 0) throw Conflict("คำขอนี้ถูกดำเนินการไปแล้วโดยผู้อื่น กรุณารีเฟรชหน้า");

  const record = await prisma.approvalRequest.findFirstOrThrow({
    where: { id: req.id },
    select: requestSelect,
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: `workflow.${input.action}`,
    entity: "ApprovalRequest",
    entityId: req.id,
    ...meta,
  });
  return serializeRequest(record);
}

export async function cancelRequest(
  companyId: string,
  session: AccessClaims,
  id: string,
  meta?: Meta,
) {
  const employeeId = requireEmployeeId(session);
  const req = await prisma.approvalRequest.findFirst({
    where: { id, companyId },
    select: { id: true, requesterEmployeeId: true, status: true },
  });
  if (!req) throw NotFound("ไม่พบคำขอ");
  if (req.requesterEmployeeId !== employeeId) throw Forbidden("ยกเลิกได้เฉพาะคำขอของตนเอง");
  if (req.status !== "PENDING") throw BadRequest("ยกเลิกได้เฉพาะคำขอที่รออนุมัติ");

  await prisma.approvalRequest.update({
    where: { id: req.id },
    data: { status: "CANCELLED", updatedById: session.sub },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "workflow.cancel",
    entity: "ApprovalRequest",
    entityId: req.id,
    ...meta,
  });
  return { ok: true as const };
}
