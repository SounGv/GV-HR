// The attendance import may raise an OT request for a clock-out past shift end, but only as PENDING, and never on a day
// that already has a request in any status (a rejected one is a decision the import must not undo).
// Staying late is not OT until someone asks and someone approves (HR rule of 20 Oct 2569; Favpo works the same way).
// Run: node scripts/check-import-ot-pending.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const src = readFileSync("src/features/attendance-import/service.ts", "utf8");

check("an OT request raised by the import is PENDING, not approved", () => {
  assert.match(src, /status: "PENDING"/);
  assert.ok(!/status: "APPROVED"/.test(src), "the import must not approve OT by itself");
  assert.ok(!/approverUserId|decidedAt:/.test(src), "nobody has decided it yet");
});
check("a day that already has an OT request in any status is skipped", () => {
  const count = src.slice(src.indexOf("prisma.overtimeRequest.count"), src.indexOf("prisma.overtimeRequest.count") + 200);
  assert.ok(!/status:\s*\{/.test(count), "the duplicate check must not filter by status");
});
check("the unused auto-approving reconcile function is gone", () => {
  assert.ok(!readFileSync("src/features/overtime/service.ts", "utf8").includes("reconcileOvertimeFromAttendance"));
});
console.log(`${n} checks passed`);
