// Checks the dashboard chart helpers: which days get coloured, the curve, the stacked bar.
// Run: node --experimental-strip-types scripts/check-chart-math.mjs
import assert from "node:assert/strict";
import { trendStats, monotonePath, stackPercents, niceCeiling } from "../src/features/dashboard/chart-math.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const day = (label, present, late, absent = 0, leave = 0) => ({ label, present, late, absent, leave });

check("an even period colours nothing", () => {
  const s = trendStats([day("a", 30, 3), day("b", 31, 3), day("c", 29, 4)]);
  assert.equal(s.days.filter((d) => d.low || d.lateHigh).length, 0);
  assert.equal(s.worst, -1);
});
check("only the clearly low day is low, and it is the worst", () => {
  const s = trendStats([day("a", 30, 2), day("b", 31, 3), day("c", 18, 9), day("d", 30, 2)]);
  assert.deepEqual(s.days.map((d) => d.low), [false, false, true, false]);
  assert.equal(s.worst, 2);
  assert.deepEqual(s.days.map((d) => d.lateHigh), [false, false, true, false]);
});
check("small teams need at least 2 people fewer to be low", () => {
  const s = trendStats([day("a", 6, 0), day("b", 6, 0), day("c", 5, 0)]);
  assert.equal(s.days[2].low, false);
});
check("a single day is never flagged", () => {
  const s = trendStats([day("a", 1, 50)]);
  assert.equal(s.days[0].low, false);
  assert.equal(s.days[0].lateHigh, false);
});
check("axis tops are round numbers above the max", () => {
  assert.deepEqual([0, 3, 7, 12, 23, 33, 61, 97].map(niceCeiling), [5, 5, 10, 20, 25, 50, 100, 100]);
});
check("the curve passes through every point and starts with M", () => {
  const pts = [[0, 10], [10, 20], [20, 5], [30, 5]];
  const d = monotonePath(pts);
  assert.ok(d.startsWith("M0,10"));
  for (const [x, y] of pts.slice(1)) assert.ok(d.includes(` ${x},${y}`), `missing ${x},${y}`);
});
check("the curve stays flat on a flat stretch (no overshoot)", () => {
  const d = monotonePath([[0, 5], [10, 5], [20, 5]]);
  assert.equal(d, "M0,5 C3.33,5 6.67,5 10,5 C13.33,5 16.67,5 20,5");
});
check("empty and one-point paths do not throw", () => {
  assert.equal(monotonePath([]), "");
  assert.equal(monotonePath([[4, 7]]), "M4,7");
});
check("stacked bar widths add to 100 and ignore negatives", () => {
  const w = stackPercents([56, 5, 3, 14]);
  assert.equal(Math.round(w.reduce((a, b) => a + b, 0)), 100);
  assert.deepEqual(stackPercents([0, 0]), [0, 0]);
  assert.deepEqual(stackPercents([-3, 1]), [0, 100]);
});

console.log(`\n${n} checks passed`);
