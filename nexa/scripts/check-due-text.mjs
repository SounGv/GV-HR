// Checks the "days left" label on the home screen's evaluation box.
// Run: node --experimental-strip-types scripts/check-due-text.mjs
import assert from "node:assert/strict";
import { dueText } from "../src/features/dashboard/due-text.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("no closing date says so and is not urgent", () => {
  assert.deepEqual(dueText(null, "2026-11-13"), { text: "ยังไม่กำหนดวันปิด", tone: "ok" });
});
check("the last day itself is urgent", () => {
  assert.deepEqual(dueText("2026-11-13", "2026-11-13"), { text: "วันนี้วันสุดท้าย", tone: "late" });
});
check("past the closing date counts the days late", () => {
  assert.deepEqual(dueText("2026-11-11", "2026-11-13"), { text: "เลยกำหนด 2 วัน", tone: "late" });
});
check("three days or fewer left is 'soon'", () => {
  assert.deepEqual(dueText("2026-11-16", "2026-11-13"), { text: "อีก 3 วัน", tone: "soon" });
  assert.deepEqual(dueText("2026-11-14", "2026-11-13"), { text: "อีก 1 วัน", tone: "soon" });
});
check("more than three days left is calm", () => {
  assert.deepEqual(dueText("2026-11-17", "2026-11-13"), { text: "อีก 4 วัน", tone: "ok" });
});
check("month and year boundaries count calendar days", () => {
  assert.equal(dueText("2026-12-01", "2026-11-30").text, "อีก 1 วัน");
  assert.equal(dueText("2027-01-01", "2026-12-31").text, "อีก 1 วัน");
});

console.log(`\n${n} checks passed`);
