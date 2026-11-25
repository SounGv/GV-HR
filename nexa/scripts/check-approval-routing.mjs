// Checks who a request is announced to.
// Run: node --experimental-strip-types scripts/check-approval-routing.mjs
import assert from "node:assert/strict";
import { routeApproval } from "../src/features/notification/approval-routing-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const NOTE = "note";
const BEER = "beer";
const TING = "ting";

check("a normal manager gets the request", () => {
  assert.deepEqual(routeApproval({ manager: { id: "ohm", approvalDelegatedToHr: false }, requesterId: "oo", hrApproverIds: [NOTE] }), { kind: "manager", employeeId: "ohm" });
});

check("a manager who handed approvals to HR sends it to HR", () => {
  assert.deepEqual(routeApproval({ manager: { id: TING, approvalDelegatedToHr: true }, requesterId: "tak", hrApproverIds: [NOTE] }), { kind: "hr", employeeIds: [NOTE], viaDelegatedManager: true });
});

check("no active manager sends it to HR until a manager is set", () => {
  assert.deepEqual(routeApproval({ manager: null, requesterId: "tak", hrApproverIds: [NOTE] }), { kind: "hr", employeeIds: [NOTE], viaDelegatedManager: false });
});

check("the HR approver's own request never comes back to themself", () => {
  assert.deepEqual(routeApproval({ manager: { id: TING, approvalDelegatedToHr: true }, requesterId: NOTE, hrApproverIds: [NOTE] }), { kind: "all-approvers" });
  assert.deepEqual(routeApproval({ manager: { id: TING, approvalDelegatedToHr: true }, requesterId: NOTE, hrApproverIds: [NOTE, BEER] }), { kind: "hr", employeeIds: [BEER], viaDelegatedManager: true });
});

check("with no HR approver at all it falls back to every approver", () => {
  assert.deepEqual(routeApproval({ manager: null, requesterId: "tak", hrApproverIds: [] }), { kind: "all-approvers" });
});

console.log(`${n} checks passed`);
