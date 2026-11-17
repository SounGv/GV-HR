// Checks which notifications are also pushed to LINE, with made-up categories only.
// Run: node --experimental-strip-types scripts/check-line-policy.mjs
import assert from "node:assert/strict";
import { LINE_CATEGORIES, isAnswerNotice, shouldPostScansToLineGroups, shouldPushToLine } from "../src/features/notification/line-policy.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("leave, OT, time corrections and evaluations go to LINE (free plan: only these for now)", () => {
  for (const c of ["leave", "overtime", "attendance-correction", "evaluation"]) assert.equal(shouldPushToLine(c), true, c);
});
check("everything else stays in the app for now (missed-scan alerts are attendance), the group broadcast included", () => {
  for (const c of ["attendance", "workflow", "expense", "medical", "performance", "meeting", "hr"]) {
    assert.equal(shouldPushToLine(c), false, c);
  }
});
check("announcements, KPI, assets, AI and system notices stay in the app", () => {
  for (const c of ["announcement", "kpi", "asset", "ai", "system"]) assert.equal(shouldPushToLine(c), false, c);
});
check("a notification without a category counts as system and stays in the app", () => {
  assert.equal(shouldPushToLine(undefined), false);
});
check("an unknown category stays in the app until it is listed on purpose", () => {
  assert.equal(shouldPushToLine("something-new"), false);
});
check("the caller's own choice always wins, in both directions", () => {
  assert.equal(shouldPushToLine("leave", false), false);
  assert.equal(shouldPushToLine("announcement", true), true);
  assert.equal(shouldPushToLine(undefined, true), true);
});
check("the list has exactly the four agreed categories", () => {
  assert.deepEqual([...LINE_CATEGORIES].sort(), ["attendance-correction", "evaluation", "leave", "overtime"]);
});
check("answers to requests (approved, not approved, cancelled) stay in the app, requests waiting for approval still go", () => {
  for (const t of ["คำขอลาได้รับอนุมัติ", "คำขอลาไม่ได้รับอนุมัติ", "คำขอลาถูกยกเลิก", "คำขอ OT ได้รับอนุมัติ", "คำขอแก้ไขเวลาได้รับอนุมัติ"]) {
    assert.equal(isAnswerNotice(t), true, t);
    assert.equal(shouldPushToLine(t.includes("OT") ? "overtime" : t.includes("เวลา") ? "attendance-correction" : "leave", undefined, t), false, t);
  }
  for (const [c, t] of [["leave", "มีคำขอลารออนุมัติ"], ["overtime", "มีคำขอ OT รออนุมัติ"], ["attendance-correction", "มีคำขอแก้ไขเวลาเข้า-ออกงานรออนุมัติ"]]) {
    assert.equal(shouldPushToLine(c, undefined, t), true, t);
  }
});
check("evaluation messages are never held back by the answer rule, and the caller's choice still wins", () => {
  assert.equal(shouldPushToLine("evaluation", undefined, "ถึงรอบประเมิน: พฤศจิกายน 2569"), true);
  assert.equal(shouldPushToLine("evaluation", undefined, "ผลประเมินได้รับอนุมัติแล้ว"), true);
  assert.equal(shouldPushToLine("leave", true, "คำขอลาได้รับอนุมัติ"), true);
});
check("check-in and check-out posts to LINE groups are off by default and on only for the exact value true", () => {
  const before = process.env.LINE_GROUP_POST_SCANS;
  delete process.env.LINE_GROUP_POST_SCANS;
  assert.equal(shouldPostScansToLineGroups(), false);
  process.env.LINE_GROUP_POST_SCANS = "false";
  assert.equal(shouldPostScansToLineGroups(), false);
  process.env.LINE_GROUP_POST_SCANS = "1";
  assert.equal(shouldPostScansToLineGroups(), false);
  process.env.LINE_GROUP_POST_SCANS = "true";
  assert.equal(shouldPostScansToLineGroups(), true);
  if (before === undefined) delete process.env.LINE_GROUP_POST_SCANS;
  else process.env.LINE_GROUP_POST_SCANS = before;
});

console.log(`\n${n} checks passed`);
