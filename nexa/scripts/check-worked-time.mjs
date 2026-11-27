// Worked time for staff paid by the day (daily attendance report). Run: node scripts/check-worked-time.mjs
import assert from "node:assert/strict";
import { dayKindOf, isPaidByDay, netWorkedHours } from "../src/features/report/worked-time.ts";

let n = 0;
function check(name, fn) {
  fn();
  n++;
  console.log(`ok - ${name}`);
}
const at = (hhmm) => new Date(`2030-01-07T${hhmm}:00+07:00`);

check("a long day loses one lunch hour: 09:00-18:00 is 8 hours", () => {
  assert.equal(netWorkedHours(at("09:00"), at("18:00")), 8);
});
check("a half day of 5 hours or less keeps all its time (no lunch taken)", () => {
  assert.equal(netWorkedHours(at("09:00"), at("14:00")), 5);
  assert.equal(netWorkedHours(at("09:00"), at("13:00")), 4);
});
check("just over 5 hours loses the lunch hour", () => {
  assert.equal(netWorkedHours(at("09:00"), at("14:30")), 4.5);
});
check("net time rounds down to 15 minutes", () => {
  assert.equal(netWorkedHours(at("09:00"), at("13:20")), 4.25);
  assert.equal(netWorkedHours(at("09:00"), at("18:14")), 8);
});
check("missing or backwards scans give no net time", () => {
  assert.equal(netWorkedHours(at("09:00"), null), null);
  assert.equal(netWorkedHours(null, at("18:00")), null);
  assert.equal(netWorkedHours(at("18:00"), at("09:00")), null);
});
check("day kind: full, part day, forgot to scan out, no scan", () => {
  assert.equal(dayKindOf(at("08:58"), at("19:06")), "ครบวัน");
  assert.equal(dayKindOf(at("09:00"), at("17:45")), "ไม่เต็มวัน");
  assert.equal(dayKindOf(at("09:00"), at("13:00")), "ไม่เต็มวัน");
  assert.equal(dayKindOf(at("09:00"), null), "ลืมสแกนออก");
  assert.equal(dayKindOf(null, null), null);
});
check("paid by the day: daily workers and DAILY pay type only", () => {
  assert.equal(isPaidByDay("DAILY_WORKER", "MONTHLY"), true);
  assert.equal(isPaidByDay("FULL_TIME", "DAILY"), true);
  assert.equal(isPaidByDay("FULL_TIME", "MONTHLY"), false);
  assert.equal(isPaidByDay("FULL_TIME", null), false);
});

console.log(`\n${n} checks passed`);
