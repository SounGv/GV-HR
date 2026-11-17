// Checks the LINE "monthly limit" guard: when the allowance is spent, calls stop until the next month (Bangkok time).
// Run: node --experimental-strip-types scripts/check-line-quota.mjs
import assert from "node:assert/strict";
import { isMonthlyLimitReply, nextBangkokMonthStartMs } from "../src/lib/integrations/line.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("the block lasts until 00:00 on the 1st of next month in Bangkok", () => {
  // 17 Nov 2026 22:00 Bangkok = 15:00 UTC
  assert.equal(new Date(nextBangkokMonthStartMs(Date.UTC(2026, 10, 17, 15, 0))).toISOString(), "2026-11-30T17:00:00.000Z");
});
check("late on the last day of the month (Bangkok is already next month in UTC terms) the block ends at the first of the month after", () => {
  // 30 Nov 2026 18:00 UTC = 1 Dec 01:00 Bangkok -> next month start is 1 Jan 00:00 Bangkok = 31 Dec 17:00 UTC
  assert.equal(new Date(nextBangkokMonthStartMs(Date.UTC(2026, 10, 30, 18, 0))).toISOString(), "2026-12-31T17:00:00.000Z");
});
check("December rolls over into the next year", () => {
  assert.equal(new Date(nextBangkokMonthStartMs(Date.UTC(2026, 11, 10, 3, 0))).toISOString(), "2026-12-31T17:00:00.000Z");
});
check("only the 429 monthly-limit reply blocks; a plain rate limit or another error does not", () => {
  assert.equal(isMonthlyLimitReply(429, '{"message":"You have reached your monthly limit."}'), true);
  assert.equal(isMonthlyLimitReply(429, '{"message":"Too many requests"}'), false);
  assert.equal(isMonthlyLimitReply(400, "monthly limit"), false);
  assert.equal(isMonthlyLimitReply(200, ""), false);
});

console.log(`\n${n} checks passed`);
