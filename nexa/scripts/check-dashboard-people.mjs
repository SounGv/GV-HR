// Checks the pure rules behind the dashboard people cards with made-up dates only.
// Run: node --experimental-strip-types scripts/check-dashboard-people.mjs
import assert from "node:assert/strict";
import {
  daysBetween,
  leaveBucket,
  probationDaysLeft,
  probationDeadline,
  tallyResponses,
} from "../src/features/dashboard-people/rules.ts";

const day = (s) => new Date(`${s}T00:00:00Z`);
const today = day("2030-03-10");
let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("daysBetween counts whole days both ways", () => {
  assert.equal(daysBetween(today, day("2030-03-17")), 7);
  assert.equal(daysBetween(today, day("2030-03-09")), -1);
});

check("leave covering today is 'today', including its first and last day", () => {
  assert.equal(leaveBucket(day("2030-03-10"), day("2030-03-12"), today), "today");
  assert.equal(leaveBucket(day("2030-03-08"), day("2030-03-10"), today), "today");
});
check("leave starting within 7 days is 'soon', day 8 is not shown", () => {
  assert.equal(leaveBucket(day("2030-03-17"), day("2030-03-18"), today), "soon");
  assert.equal(leaveBucket(day("2030-03-18"), day("2030-03-19"), today), null);
});
check("leave that already ended is not shown", () => {
  assert.equal(leaveBucket(day("2030-03-05"), day("2030-03-09"), today), null);
});

check("probation end date wins over the hire date", () => {
  const d = probationDeadline(day("2029-01-01"), day("2030-04-01"));
  assert.equal(d.source, "probation");
  assert.equal(d.date.toISOString().slice(0, 10), "2030-04-01");
});
check("without an end date the deadline is day 120 (hire day = day 1)", () => {
  const d = probationDeadline(day("2030-01-01"), null);
  assert.equal(d.source, "day120");
  assert.equal(d.date.toISOString().slice(0, 10), "2030-04-30");
});
check("no hire date and no end date gives no deadline", () => {
  assert.equal(probationDeadline(null, null), null);
  assert.equal(probationDaysLeft(null, today), null);
});
check("probation window is 0..30 days, passed or far-off dates are dropped", () => {
  const at = (s) => ({ date: day(s), source: "probation" });
  assert.equal(probationDaysLeft(at("2030-03-10"), today), 0);
  assert.equal(probationDaysLeft(at("2030-04-09"), today), 30);
  assert.equal(probationDaysLeft(at("2030-04-10"), today), null);
  assert.equal(probationDaysLeft(at("2030-03-09"), today), null);
});

check("tally counts submitted, in progress and not started", () => {
  const t = tallyResponses(["SUBMITTED", "SUBMITTED", "IN_PROGRESS", "PENDING"]);
  assert.deepEqual(t, { total: 4, submitted: 2, inProgress: 1, pending: 1, percent: 50 });
});
check("tally of nothing is 0%, not NaN", () => {
  assert.deepEqual(tallyResponses([]), { total: 0, submitted: 0, inProgress: 0, pending: 0, percent: 0 });
});
check("tally rounds to a whole percent", () => {
  assert.equal(tallyResponses(["SUBMITTED", "PENDING", "PENDING"]).percent, 33);
});

console.log(`\n${n} checks passed`);
