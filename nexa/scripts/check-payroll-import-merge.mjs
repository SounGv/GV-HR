// A payroll file must add to what HR keyed on a payslip, not replace it.
// Run: node --experimental-strip-types scripts/check-payroll-import-merge.mjs
import assert from "node:assert/strict";
import { mergeAdjustmentLines } from "../src/features/payroll-import/merge.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a line HR keyed by hand stays when the file brings a different one", () => {
  const out = mergeAdjustmentLines([{ label: "หักเบิกล่วงหน้า", amount: 2000 }], [{ label: "โบนัส", amount: 5000 }]);
  assert.deepEqual(out, [
    { label: "หักเบิกล่วงหน้า", amount: 2000 },
    { label: "โบนัส", amount: 5000 },
  ]);
});

check("importing the same file twice gives the same result (amounts are not doubled)", () => {
  const file = [{ label: "โบนัส", amount: 5000 }];
  const once = mergeAdjustmentLines([{ label: "ค่าเดินทาง", amount: 300 }], file);
  const twice = mergeAdjustmentLines(once, file);
  assert.deepEqual(twice, once);
});

check("a corrected file changes the amount of a line it has again", () => {
  const first = mergeAdjustmentLines([], [{ label: "โบนัส", amount: 5000 }]);
  const fixed = mergeAdjustmentLines(first, [{ label: "โบนัส", amount: 4500 }]);
  assert.deepEqual(fixed, [{ label: "โบนัส", amount: 4500 }]);
});

check("labels match without caring about case or spaces around them", () => {
  const out = mergeAdjustmentLines([{ label: " Bonus ", amount: 1 }], [{ label: "bonus", amount: 2 }]);
  assert.deepEqual(out, [{ label: "bonus", amount: 2 }]);
});

check("two lines with the same label in one file are both kept", () => {
  const out = mergeAdjustmentLines([], [
    { label: "ค่าล่วงเวลาพิเศษ", amount: 100 },
    { label: "ค่าล่วงเวลาพิเศษ", amount: 200 },
  ]);
  assert.equal(out.length, 2);
});

check("nothing on the payslip yet, or nothing in the file", () => {
  assert.deepEqual(mergeAdjustmentLines(undefined, [{ label: "a", amount: 1 }]), [{ label: "a", amount: 1 }]);
  assert.deepEqual(mergeAdjustmentLines(null, []), []);
  assert.deepEqual(mergeAdjustmentLines([{ label: "a", amount: 1 }], []), [{ label: "a", amount: 1 }]);
});

console.log(`\n${n} checks passed`);
