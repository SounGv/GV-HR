// Checks the working-day arithmetic behind the attendance reports, with made-up dates.
// Run: node --experimental-strip-types scripts/check-report-work-days.mjs
import assert from "node:assert/strict";
import { absentDays, employedDays, leaveCover, workingDays } from "../src/features/report/work-days.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

// November 2026: 1 Nov is a Sunday, so the working days are Mon to Fri.
const none = new Set();
const nov = workingDays("2026-11-01", "2026-11-30", "2026-12-31", none);

check("a full month has the Monday to Friday days only", () => {
  assert.equal(nov.length, 21);
  assert.ok(!nov.includes("2026-11-07"));
});
check("a holiday is not a working day", () => {
  assert.equal(workingDays("2026-11-01", "2026-11-30", "2026-12-31", new Set(["2026-11-02"])).length, 20);
});
check("days after today are not counted", () => {
  assert.deepEqual(workingDays("2026-11-01", "2026-11-30", "2026-11-04", none), ["2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.deepEqual(workingDays("2026-11-10", "2026-11-30", "2026-11-04", none), []);
});
check("someone hired on 10 Nov is not absent for the days before", () => {
  const mine = employedDays(nov, "2026-11-10", null);
  assert.equal(mine[0], "2026-11-10");
  assert.equal(absentDays(mine, new Set(), new Map()), 15);
});
check("a termination date ends the person's days", () => {
  assert.equal(employedDays(nov, null, "2026-11-06").length, 5);
});
check("leave from 26 Nov to 3 Dec counts only the working days inside November", () => {
  const cover = leaveCover({ startIso: "2026-11-26", endIso: "2026-12-03", halfDay: false }, new Set(nov));
  assert.equal([...cover.values()].reduce((s, v) => s + v, 0), 3); // Thu 26, Fri 27, Mon 30
});
check("leave in the future part of the month is not counted when days stop at today", () => {
  const days = workingDays("2026-11-01", "2026-11-30", "2026-11-13", none);
  const cover = leaveCover({ startIso: "2026-11-16", endIso: "2026-11-20", halfDay: false }, new Set(days));
  assert.equal(cover.size, 0);
  // two real absences this week stay visible
  assert.equal(absentDays(["2026-11-12", "2026-11-13"], new Set(), cover), 2);
});
check("a half day of leave counts 0.5 and leaves the other half absent", () => {
  const cover = leaveCover({ startIso: "2026-11-10", endIso: "2026-11-10", halfDay: true }, new Set(nov));
  assert.equal(absentDays(["2026-11-10"], new Set(), cover), 0.5);
});
check("a scan plus a half day of leave is one covered day, not 1.5", () => {
  const cover = leaveCover({ startIso: "2026-11-10", endIso: "2026-11-10", halfDay: true }, new Set(nov));
  assert.equal(absentDays(["2026-11-10", "2026-11-11"], new Set(["2026-11-10"]), cover), 1);
});

console.log(`\n${n} checks passed`);
