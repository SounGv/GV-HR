import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/format";
import { createNotification, notifyPermissionHolders } from "./service";
import { routeApproval } from "./approval-routing-rules";

// shortcut: the HR department is found by its code. If HR ever renames the code, requests fall back
// to every holder of the approve permission (the behaviour before this existed), never to nobody.
const HR_DEPARTMENT_CODE = "HR";

const ACTIVE = ["ACTIVE", "ON_LEAVE"] as const;

type Notice = { title: string; body: string; category?: string; link?: string };

/**
 * Announces a request that needs a decision to the right people and says where it went.
 * `permissionKey` is the approve permission of the request kind (leave:approve, overtime:approve,
 * attendance:approve). One place decides this so leave, OT and time corrections cannot drift apart;
 * the rule itself is in approval-routing-rules.ts.
 *
 * Only the announcement is routed here. Who may actually decide a request is unchanged: the
 * requester's manager and every HR-level approver can open and decide it.
 */
export async function notifyApprovalOwners(
  companyId: string,
  requesterId: string,
  permissionKey: string,
  notice: Notice,
  createdById?: string | null,
): Promise<{ routedTo: string }> {
  const requester = await prisma.employee.findFirst({
    where: { id: requesterId, companyId, deletedAt: null },
    select: { managerId: true },
  });
  // The manager on file may have resigned or been removed: only an active one counts.
  const manager = requester?.managerId
    ? await prisma.employee.findFirst({
        where: { id: requester.managerId, companyId, deletedAt: null, status: { in: [...ACTIVE] } },
        select: { id: true, firstName: true, lastName: true, nickname: true, approvalDelegatedToHr: true },
      })
    : null;

  const hrApprovers = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: [...ACTIVE] },
      department: { code: HR_DEPARTMENT_CODE, deletedAt: null },
      user: { roles: { some: { role: { permissions: { some: { permission: { key: permissionKey } } } } } } },
    },
    select: { id: true, firstName: true, lastName: true, nickname: true },
  });

  const route = routeApproval({
    manager: manager ? { id: manager.id, approvalDelegatedToHr: manager.approvalDelegatedToHr } : null,
    requesterId,
    hrApproverIds: hrApprovers.map((h) => h.id),
  });

  if (route.kind === "manager" && manager) {
    await createNotification(companyId, manager.id, notice, createdById);
    return { routedTo: displayName(manager) };
  }
  if (route.kind === "hr") {
    // Sequential on purpose: one pooled connection.
    for (const id of route.employeeIds) await createNotification(companyId, id, notice, createdById);
    const names = hrApprovers.filter((h) => route.employeeIds.includes(h.id)).map((h) => displayName(h)).join(", ");
    const on = route.viaDelegatedManager && manager ? ` แทน ${displayName(manager)}` : "";
    return { routedTo: `${names} (ฝ่ายบุคคล)${on}` };
  }
  await notifyPermissionHolders(companyId, permissionKey, requesterId, notice, createdById);
  return { routedTo: "HR (ผู้มีสิทธิ์อนุมัติ)" };
}
