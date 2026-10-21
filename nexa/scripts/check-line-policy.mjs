// Checks which notifications are also pushed to LINE, with made-up categories only.
// Run: node --experimental-strip-types scripts/check-line-policy.mjs
import assert from "node:assert/strict";
import { LINE_CATEGORIES, shouldPostScansToLineGroups, shouldPushToLine } from "../src/features/notification/line-policy.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("things a person must act on or answer go to LINE", () => {
  for (const c of ["leave", "overtime", "attendance", "workflow", "expense", "medical", "performance", "evaluation", "meeting", "hr"]) {
    assert.equal(shouldPushToLine(c), true, c);
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
check("the list has exactly the ten agreed categories", () => {
  assert.equal(LINE_CATEGORIES.size, 10);
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
