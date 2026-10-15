// Checks the OT pay rate for a normal day and for working on a day off, with made-up pay only.
// Run: node --experimental-strip-types scripts/check-overtime-rate.mjs
import assert from "node:assert/strict";
import { DAY_OFF_MULTIPLIER, DEFAULT_MULTIPLIER, dayOffReason, estimateAmount, multiplierFor } from "../src/features/overtime/calc.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const monthly = { compensationType: "MONTHLY", baseSalary: 24000, dailyRate: null, hourlyRate: null }; // 100 per hour

check("a normal working day is paid at 1.5 times, a day off at 2 times", () => {
  assert.equal(multiplierFor("NORMAL"), 1.5);
  assert.equal(multiplierFor("DAY_OFF"), 2);
  assert.equal(DEFAULT_MULTIPLIER, 1.5);
  assert.equal(DAY_OFF_MULTIPLIER, 2);
});
check("the same hours pay more on a day off", () => {
  assert.equal(estimateAmount(monthly, 2, multiplierFor("NORMAL")), 300);
  assert.equal(estimateAmount(monthly, 2, multiplierFor("DAY_OFF")), 400);
});
check("the half-hour rounding still applies at the day-off rate", () => {
  // 1h20m = 1.33h is billed as 1.5h: 100 * 2 * 1.5
  assert.equal(estimateAmount(monthly, 1.33, 2), 300);
});
check("a daily-wage worker is priced from the daily rate over 8 hours", () => {
  assert.equal(estimateAmount({ compensationType: "DAILY", baseSalary: null, dailyRate: 800, hourlyRate: null }, 1, 2), 200);
});

// 2030-03-04 is a Monday, 2030-03-09 a Saturday, 2030-03-10 a Sunday.
const holidays = [{ date: "2030-03-06T00:00:00.000Z", name: "วันตัวอย่าง" }];
check("a Sunday is a day off and says why", () => {
  assert.equal(dayOffReason("2030-03-10", holidays), "เป็นวันอาทิตย์");
});
check("a company holiday is a day off and names the holiday", () => {
  assert.equal(dayOffReason("2030-03-06", holidays), "เป็นวันหยุด “วันตัวอย่าง”");
});
check("a holiday that falls on a Sunday names the holiday", () => {
  assert.equal(dayOffReason("2030-03-10", [{ date: "2030-03-10", name: "วันตัวอย่าง" }]), "เป็นวันหยุด “วันตัวอย่าง”");
});
check("an ordinary weekday and a Saturday are not detected as a day off", () => {
  assert.equal(dayOffReason("2030-03-04", holidays), null);
  assert.equal(dayOffReason("2030-03-09", holidays), null);
});
check("an empty or half-typed date is not a day off", () => {
  assert.equal(dayOffReason("", holidays), null);
  assert.equal(dayOffReason("2030-03", holidays), null);
});
check("it works before the holiday list has loaded", () => {
  assert.equal(dayOffReason("2030-03-10"), "เป็นวันอาทิตย์");
  assert.equal(dayOffReason("2030-03-04"), null);
});

console.log(`\n${n} checks passed`);
