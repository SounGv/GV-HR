// Checks which balance hourly leave uses: its own hour quota, or the days left at 8 hours a day.
// Run: node --experimental-strip-types scripts/check-leave-hour-pool.mjs
import assert from "node:assert/strict";
import { HOURS_PER_LEAVE_DAY, hasOwnHourQuota, hourlyUsage, remainingLeaveHours } from "../src/features/leave/hour-pool.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("with no hour quota, 21.3 sick days left means 170.4 hours can be taken", () => {
  assert.equal(remainingLeaveHours({ totalDays: 30, usedDays: 8.7, totalHours: 0, usedHours: 0 }), 170.4);
});
check("a type with its own hour quota counts hours only", () => {
  assert.equal(remainingLeaveHours({ totalDays: 30, usedDays: 0, totalHours: 16, usedHours: 6 }), 10);
});
check("nothing left is 0, never negative", () => {
  assert.equal(remainingLeaveHours({ totalDays: 6, usedDays: 7, totalHours: 0, usedHours: 0 }), 0);
  assert.equal(remainingLeaveHours({ totalDays: 0, usedDays: 0, totalHours: 4, usedHours: 5 }), 0);
});
check("approving 2 hours with no hour quota uses a quarter of a day", () => {
  assert.deepEqual(hourlyUsage(2, 0), { usedHours: 0, usedDays: 0.25 });
});
check("approving 2 hours with an hour quota uses 2 hours and no days", () => {
  assert.deepEqual(hourlyUsage(2, 16), { usedHours: 2, usedDays: 0 });
});
check("a full working day of hours equals one leave day", () => {
  assert.equal(hourlyUsage(HOURS_PER_LEAVE_DAY, 0).usedDays, 1);
  assert.equal(hasOwnHourQuota(0), false);
  assert.equal(hasOwnHourQuota(1), true);
});
check("taking then giving back the same request leaves the balance as it was", () => {
  const before = { totalDays: 30, usedDays: 3, totalHours: 0, usedHours: 0 };
  const use = hourlyUsage(1.5, before.totalHours);
  const after = { ...before, usedDays: before.usedDays + use.usedDays - use.usedDays };
  assert.equal(remainingLeaveHours(after), remainingLeaveHours(before));
});

console.log(`\n${n} checks passed`);
