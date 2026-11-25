/**
 * Who a leave / OT / time-correction request should be announced to.
 * Pure (no imports); checked by `node --experimental-strip-types scripts/check-approval-routing.mjs`.
 *
 * - A requester with an active manager goes to that manager, unless the manager has handed approvals
 *   to HR (`approvalDelegatedToHr`).
 * - A requester with no active manager, or whose manager handed approvals to HR, goes to the HR
 *   department's approvers, never to the requester themself.
 * - If no HR approver is left (for instance the requester is the only one), fall back to every
 *   holder of the approve permission, which is what the system did before.
 */

export type ApprovalRoute =
  | { kind: "manager"; employeeId: string }
  | { kind: "hr"; employeeIds: string[]; viaDelegatedManager: boolean }
  | { kind: "all-approvers" };

export interface RouteInput {
  /** The requester's manager when that person is still active, else null. */
  manager: { id: string; approvalDelegatedToHr: boolean } | null;
  requesterId: string;
  /** Active employees of the HR department who hold the approve permission (may include the requester). */
  hrApproverIds: readonly string[];
}

export function routeApproval(input: RouteInput): ApprovalRoute {
  const { manager, requesterId, hrApproverIds } = input;
  if (manager && !manager.approvalDelegatedToHr) return { kind: "manager", employeeId: manager.id };
  const hr = hrApproverIds.filter((id) => id !== requesterId);
  if (hr.length > 0) return { kind: "hr", employeeIds: hr, viaDelegatedManager: !!manager };
  return { kind: "all-approvers" };
}
