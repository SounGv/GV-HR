// Checks the small helpers behind the assistant's read-only tools, with made-up numbers and dates.
// Run: node --experimental-strip-types scripts/check-ai-read-summary.mjs
import assert from "node:assert/strict";
import { balanceLine, bangkokToday, clampRange, LEAVE_LABEL, percentDone } from "../src/features/ai/read-summary.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("remaining leave counts the days still waiting for approval", () => {
  assert.deepEqual(balanceLine("ANNUAL", 10, 3, 2), { type: "ลาพักร้อน", totalDays: 10, usedDays: 3, pendingDays: 2, remainingDays: 5 });
});
check("half days stay exact, with no 0.30000000000000004", () => {
  assert.equal(balanceLine("SICK", 30, 0.1, 0.2).remainingDays, 29.7);
  assert.equal(balanceLine("PERSONAL", 3, 1.5, 0).remainingDays, 1.5);
});
check("a quota that was overspent shows a negative number instead of hiding it", () => {
  assert.equal(balanceLine("PERSONAL", 3, 3, 1).remainingDays, -1);
});
check("an unknown leave type is shown as it is rather than dropped", () => {
  assert.equal(balanceLine("SOMETHING", 1, 0, 0).type, "SOMETHING");
  assert.equal(LEAVE_LABEL.UNPAID, "ลาไม่รับค่าจ้าง");
});
check("a schedule question defaults to today and the next 6 days", () => {
  assert.deepEqual(clampRange(undefined, undefined, "2026-11-14"), { from: "2026-11-14", to: "2026-11-20", cut: false });
});
check("only a start date gives that day and the 6 after it, across a month end", () => {
  assert.deepEqual(clampRange("2026-11-28", undefined, "2026-11-14"), { from: "2026-11-28", to: "2026-12-04", cut: false });
});
check("an end before the start becomes a single day", () => {
  assert.deepEqual(clampRange("2026-11-20", "2026-11-10", "2026-11-14"), { from: "2026-11-20", to: "2026-11-20", cut: false });
});
check("a range longer than 31 days is cut to 31 days and says so", () => {
  assert.deepEqual(clampRange("2026-11-01", "2027-03-01", "2026-11-14"), { from: "2026-11-01", to: "2026-12-01", cut: true });
  assert.equal(clampRange("2026-11-01", "2026-12-01", "2026-11-14").cut, false);
});
check("dates that are not real days are ignored, not guessed", () => {
  assert.deepEqual(clampRange("2026-02-30", "not-a-date", "2026-11-14"), { from: "2026-11-14", to: "2026-11-20", cut: false });
  assert.deepEqual(clampRange(20261114, null, "2026-11-14"), { from: "2026-11-14", to: "2026-11-20", cut: false });
});
check("today is Bangkok's date: 18:00 UTC is already the next day there", () => {
  assert.equal(bangkokToday(new Date("2026-11-14T18:00:00Z")), "2026-11-15");
  assert.equal(bangkokToday(new Date("2026-11-14T16:59:00Z")), "2026-11-14");
});
check("percent done is a whole number and never NaN for an empty round", () => {
  assert.equal(percentDone(1, 3), 33);
  assert.equal(percentDone(2, 3), 67);
  assert.equal(percentDone(0, 0), 0);
});

console.log(`\n${n} checks passed`);
