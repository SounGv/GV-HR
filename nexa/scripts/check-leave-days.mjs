// Checks how leave days are counted (Monday to Saturday; Sundays skipped) with made-up dates only.
// Run: node --experimental-strip-types scripts/check-leave-days.mjs
import assert from "node:assert/strict";
import { computeLeaveDays, isSunday } from "../src/features/leave/days.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const day = (s) => new Date(`${s}T00:00:00Z`);
// 2030-03-04 is a Monday.
const MON = "2030-03-04";
const FRI = "2030-03-08";
const SAT = "2030-03-09";
const SUN = "2030-03-10";
const NEXT_MON = "2030-03-11";

check("the sample dates are the weekdays the checks assume", () => {
  assert.equal(day(MON).getUTCDay(), 1);
  assert.equal(day(SUN).getUTCDay(), 0);
  assert.equal(isSunday(day(SUN)), true);
  assert.equal(isSunday(day(SAT)), false);
});
check("a single working day counts 1, Saturday included", () => {
  assert.equal(computeLeaveDays(day(MON), day(MON), false), 1);
  assert.equal(computeLeaveDays(day(SAT), day(SAT), false), 1);
});
check("Monday to Saturday counts 6 days", () => {
  assert.equal(computeLeaveDays(day(MON), day(SAT), false), 6);
});
check("a range across a Sunday skips it: Friday to Monday is 3 days, not 4", () => {
  assert.equal(computeLeaveDays(day(FRI), day(NEXT_MON), false), 3);
});
check("a whole week Monday to the next Monday is 7 working days", () => {
  assert.equal(computeLeaveDays(day(MON), day(NEXT_MON), false), 7);
});
check("a request only on a Sunday counts 0 (the caller must reject it)", () => {
  assert.equal(computeLeaveDays(day(SUN), day(SUN), false), 0);
});
check("half a day is 0.5 on a working day and 0 on a Sunday", () => {
  assert.equal(computeLeaveDays(day(MON), day(MON), true), 0.5);
  assert.equal(computeLeaveDays(day(SUN), day(SUN), true), 0);
});
check("a long leave is counted without drifting (30 calendar days = 26 working days here)", () => {
  // 2030-03-04 (Mon) for 30 days ends 2030-04-02; 4 Sundays fall inside (Mar 10, 17, 24, 31).
  assert.equal(computeLeaveDays(day(MON), day("2030-04-02"), false), 26);
});
check("an end date before the start counts 0", () => {
  assert.equal(computeLeaveDays(day(NEXT_MON), day(MON), false), 0);
});

console.log(`\n${n} checks passed`);
