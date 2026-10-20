// Checks that OT on a normal day must sit outside the shift (before it starts or after it ends).
// Run: node --experimental-strip-types scripts/check-ot-shift-overlap.mjs
import assert from "node:assert/strict";
import { shiftOverlapMessage } from "../src/features/overtime/calc.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const day = { startMin: 9 * 60, endMin: 18 * 60 };

check("after the shift ends is fine", () => {
  assert.equal(shiftOverlapMessage("18:00", "20:30", day), null);
  assert.equal(shiftOverlapMessage("18:40", "19:09", day), null);
});
check("before the shift starts is fine", () => {
  assert.equal(shiftOverlapMessage("07:00", "09:00", day), null);
});
check("the whole working day is refused (the 12 Oct case)", () => {
  assert.match(shiftOverlapMessage("09:06", "18:31", day), /หลังเลิกงาน 18:00/);
});
check("a full day with no scan is refused (the 14 Oct case)", () => {
  assert.ok(shiftOverlapMessage("09:00", "19:00", day));
});
check("starting an hour before the shift ends is refused", () => {
  assert.ok(shiftOverlapMessage("17:00", "19:00", day));
});
check("a Saturday half day ends at 12:00, so 13:00 onwards is fine", () => {
  assert.equal(shiftOverlapMessage("13:00", "17:00", { startMin: 540, endMin: 720 }), null);
});
check("an overnight shift is not checked", () => {
  assert.equal(shiftOverlapMessage("23:00", "23:59", { startMin: 22 * 60, endMin: 6 * 60 }), null);
});

console.log(`\n${n} checks passed`);
