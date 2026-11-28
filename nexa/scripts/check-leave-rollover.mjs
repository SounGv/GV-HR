// Checks the pure rules for rolling leave entitlements into a new year, with made-up numbers only.
// Run: node --experimental-strip-types scripts/check-leave-rollover.mjs
import assert from "node:assert/strict";
import { rolloverBalances, yearsProblem } from "../src/features/leave/year-rollover.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const prev = [
  { type: "SICK", totalDays: 30, usedDays: 4.5, totalHours: 0 },
  { type: "PERSONAL", totalDays: 6, usedDays: 5, totalHours: 0 },
  { type: "ANNUAL", totalDays: 10, usedDays: 7, totalHours: 0 },
];

check("the new year starts with the same entitlement and carries nothing by default", () => {
  assert.deepEqual(rolloverBalances(prev, 0), [
    { type: "SICK", totalDays: 30, totalHours: 0, carried: 0 },
    { type: "PERSONAL", totalDays: 6, totalHours: 0, carried: 0 },
    { type: "ANNUAL", totalDays: 10, totalHours: 0, carried: 0 },
  ]);
});
check("annual leave carries over what is left, up to the cap", () => {
  assert.equal(rolloverBalances(prev, 5).find((r) => r.type === "ANNUAL").carried, 3); // 3 left, cap 5
  assert.equal(rolloverBalances(prev, 2).find((r) => r.type === "ANNUAL").carried, 2); // 3 left, cap 2
  assert.equal(rolloverBalances(prev, 2).find((r) => r.type === "ANNUAL").totalDays, 12);
});
check("sick and personal leave never carry over", () => {
  const r = rolloverBalances(prev, 99);
  assert.equal(r.find((x) => x.type === "SICK").totalDays, 30);
  assert.equal(r.find((x) => x.type === "PERSONAL").carried, 0);
});
check("someone who used more than their entitlement carries nothing", () => {
  const over = [{ type: "ANNUAL", totalDays: 6, usedDays: 8, totalHours: 0 }];
  assert.equal(rolloverBalances(over, 5)[0].carried, 0);
  assert.equal(rolloverBalances(over, 5)[0].totalDays, 6);
});
check("half days stay clean after carrying", () => {
  const half = [{ type: "ANNUAL", totalDays: 7, usedDays: 3.3, totalHours: 0 }];
  assert.equal(rolloverBalances(half, 10)[0].carried, 3.7);
  assert.equal(rolloverBalances(half, 10)[0].totalDays, 10.7);
});
check("a carried-in balance does not snowball: the base stays the fixed entitlement", () => {
  // 6 days a year. 2569 -> 2570: 3 unused, carry 3 -> total 9 (3 of it carried).
  const y2570 = rolloverBalances([{ type: "ANNUAL", totalDays: 6, usedDays: 3, totalHours: 0, carriedDays: 0 }], 10)[0];
  assert.deepEqual([y2570.totalDays, y2570.carried], [9, 3]);
  // 2570 -> 2571: nothing used of 9. Base is 9 - 3 = 6, carry is capped at 10 and is 9 -> total 15, not 9 + 9 = 18.
  const y2571 = rolloverBalances([{ type: "ANNUAL", totalDays: 9, usedDays: 0, totalHours: 0, carriedDays: 3 }], 10)[0];
  assert.deepEqual([y2571.totalDays, y2571.carried], [15, 9]);
  // With a cap of 3 the year after is 6 + 3 = 9, not 9 + 3 = 12, however many years pass.
  const y2572 = rolloverBalances([{ type: "ANNUAL", totalDays: 9, usedDays: 0, totalHours: 0, carriedDays: 3 }], 3)[0];
  assert.deepEqual([y2572.totalDays, y2572.carried], [9, 3]);
});
check("sick and personal rows keep their entitlement whatever carriedDays holds", () => {
  const r = rolloverBalances([{ type: "PERSONAL", totalDays: 6, usedDays: 6, totalHours: 0, carriedDays: 0 }], 10)[0];
  assert.equal(r.totalDays, 6);
});
check("types other than the three paid ones are ignored", () => {
  assert.deepEqual(rolloverBalances([{ type: "UNPAID", totalDays: 0, usedDays: 2, totalHours: 0 }], 5), []);
});
check("hour pools are copied as they are", () => {
  assert.equal(rolloverBalances([{ type: "SICK", totalDays: 30, usedDays: 0, totalHours: 16 }], 0)[0].totalHours, 16);
});
check("years must move forward by 1 to 5", () => {
  assert.equal(yearsProblem(2026, 2027), null);
  assert.ok(yearsProblem(2026, 2026));
  assert.ok(yearsProblem(2027, 2026));
  assert.ok(yearsProblem(2026, 2032));
  assert.ok(yearsProblem(2026.5, 2027));
});

console.log(`\n${n} checks passed`);
