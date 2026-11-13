// node --experimental-strip-types scripts/check-pay-consistency.mjs
import assert from "node:assert/strict";
import { employmentPayMismatch as m } from "../src/features/employee/pay-consistency.ts";

assert.equal(m("FULL_TIME", "MONTHLY"), null);
assert.equal(m("DAILY_WORKER", "DAILY"), null);
assert.equal(m("PART_TIME", "HOURLY"), null);
assert.equal(m("PART_TIME", "DAILY"), null);
assert.ok(m("FULL_TIME", "DAILY")?.includes("ประจำ"));
assert.ok(m("PROBATION", "DAILY"));
assert.ok(m("DAILY_WORKER", "MONTHLY")?.includes("รายวัน"));
assert.ok(m("DAILY_WORKER", "HOURLY"));
console.log("pay-consistency: ok");
