// Checks hourly unpaid leave for daily-wage staff: who may take it, and what payroll takes off.
// Run: node --experimental-strip-types scripts/check-hourly-unpaid.mjs
import assert from "node:assert/strict";
import { canTakeHourly } from "../src/features/leave/days.ts";
import { computePayroll } from "../src/features/payroll/calc.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const line = (comp, prefix) => comp.deductions.find((d) => d.label.startsWith(prefix));

check("sick and personal leave can be taken by the hour by anyone", () => {
  for (const pay of ["MONTHLY", "DAILY", "HOURLY", null]) {
    assert.equal(canTakeHourly("SICK", pay), true);
    assert.equal(canTakeHourly("PERSONAL", pay), true);
  }
});
check("unpaid leave by the hour is for daily-wage staff only", () => {
  assert.equal(canTakeHourly("UNPAID", "DAILY"), true);
  for (const pay of ["MONTHLY", "HOURLY", null, undefined])
    assert.equal(canTakeHourly("UNPAID", pay), false);
});
check("annual leave and the other types stay day-only", () => {
  for (const t of ["ANNUAL", "OTHER", "HOLIDAY_SWAP"])
    assert.equal(canTakeHourly(t, "DAILY"), false);
});
check("daily rate 400, 20 days worked, 1 hour unpaid: full days paid, 50 taken off", () => {
  const comp = computePayroll({
    baseSalary: 400 * 20,
    compensationType: "DAILY",
    unpaidLeaveHours: 1,
    unpaidLeaveHourRate: 400 / 8,
  });
  assert.equal(comp.gross, 8000);
  assert.deepEqual(line(comp, "หักลาไม่รับค่าจ้าง"), {
    label: "หักลาไม่รับค่าจ้าง (1 ชม.)",
    amount: 50,
  });
  assert.equal(comp.net, 8000 - comp.totalDeductions);
});
check("several requests add up (2 + 1.5 hours at 380 a day = 166.25 → 166)", () => {
  const comp = computePayroll({
    baseSalary: 380 * 10,
    compensationType: "DAILY",
    unpaidLeaveHours: 3.5,
    unpaidLeaveHourRate: 380 / 8,
  });
  assert.deepEqual(line(comp, "หักลาไม่รับค่าจ้าง"), {
    label: "หักลาไม่รับค่าจ้าง (3.5 ชม.)",
    amount: 166,
  });
});
check("no hours, no line; a monthly payslip is unchanged", () => {
  const daily = computePayroll({ baseSalary: 8000, compensationType: "DAILY" });
  assert.equal(line(daily, "หักลาไม่รับค่าจ้าง"), undefined);
  const before = computePayroll({ baseSalary: 30000, unpaidLeaveDays: 1 });
  const after = computePayroll({
    baseSalary: 30000,
    unpaidLeaveDays: 1,
    unpaidLeaveHours: 0,
    unpaidLeaveHourRate: 0,
  });
  assert.deepEqual(after, before);
});

console.log(`\n${n} checks passed`);
