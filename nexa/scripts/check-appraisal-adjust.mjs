// Checks the rules for adjusting a calculated score by hand.
// Run: node --experimental-strip-types scripts/check-appraisal-adjust.mjs
import assert from "node:assert/strict";
import { MAX_ADJUST_POINTS, MIN_REASON_LENGTH, canAdjustStatus, checkAdjustment, checkRevert, roundPercent } from "../src/features/appraisal-round/adjust-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const why = "หัวหน้าให้คะแนนต่ำกว่าผลงานจริงที่มีหลักฐาน";

check("the owner's limits are 5 points and a 10 character reason", () => {
  assert.equal(MAX_ADJUST_POINTS, 5);
  assert.equal(MIN_REASON_LENGTH, 10);
});
check("a change inside the limit with a reason is allowed, up or down", () => {
  assert.equal(checkAdjustment({ original: 75.9, current: 75.9, next: 74, reason: why }), null);
  assert.equal(checkAdjustment({ original: 75.9, current: 75.9, next: 80.9, reason: why }), null, "exactly 5 up is allowed");
  assert.equal(checkAdjustment({ original: 75.9, current: 75.9, next: 70.9, reason: why }), null, "exactly 5 down is allowed");
});
check("more than 5 points from the calculated score is refused and the message names the allowed range", () => {
  const m = checkAdjustment({ original: 75.9, current: 75.9, next: 81, reason: why });
  assert.match(m, /ไม่เกิน 5 จุด/);
  assert.match(m, /70\.9 ถึง 80\.9/);
});
check("the limit is measured from the original, so a second adjustment cannot pile on", () => {
  // adjusted once from 70 to 75 (5 up); asking for 77 now would be 7 from the original
  assert.match(checkAdjustment({ original: 70, current: 75, next: 77, reason: why }), /ไม่เกิน 5 จุด/);
  assert.equal(checkAdjustment({ original: 70, current: 75, next: 73, reason: why }), null, "moving back toward the original is fine");
});
check("the range is cut at 0 and 100", () => {
  assert.match(checkAdjustment({ original: 98, current: 98, next: 104, reason: why }), /0 ถึง 100/);
  assert.match(checkAdjustment({ original: 98, current: 98, next: 100.1, reason: why }), /0 ถึง 100/);
  assert.equal(checkAdjustment({ original: 98, current: 98, next: 100, reason: why }), null);
  assert.match(checkAdjustment({ original: 3, current: 3, next: -1, reason: why }), /0 ถึง 100/);
  assert.match(checkAdjustment({ original: 98, current: 98, next: 92, reason: why }), /93 ถึง 100/, "the hint never offers more than 100");
});
check("a number that is not a number, or the same score, is refused", () => {
  assert.match(checkAdjustment({ original: 80, current: 80, next: Number.NaN, reason: why }), /0 ถึง 100/);
  assert.match(checkAdjustment({ original: 80, current: 80, next: 80.04, reason: why }), /เท่าเดิม/, "rounds to one decimal first");
});
check("a reason shorter than 10 characters, or only spaces, is refused", () => {
  assert.match(checkAdjustment({ original: 80, current: 80, next: 82, reason: "สั้น" }), /อย่างน้อย 10/);
  assert.match(checkAdjustment({ original: 80, current: 80, next: 82, reason: "          " }), /อย่างน้อย 10/);
  assert.equal(checkAdjustment({ original: 80, current: 80, next: 82, reason: "  ครบสิบตัวอักษรพอดี  " }), null);
});
check("undoing needs a reason too", () => {
  assert.match(checkRevert("สั้น"), /อย่างน้อย 10/);
  assert.equal(checkRevert(why), null);
});
check("only a calculated result can be adjusted; approved, published and not calculated cannot", () => {
  assert.equal(canAdjustStatus("CALCULATED"), true);
  for (const s of ["NOT_CALCULATED", "APPROVED", "PUBLISHED", "ACKNOWLEDGED"]) assert.equal(canAdjustStatus(s), false, s);
});
check("a score is stored with one decimal place", () => {
  assert.equal(roundPercent(74.04), 74);
  assert.equal(roundPercent(74.06), 74.1);
});

console.log(`\n${n} checks passed`);
