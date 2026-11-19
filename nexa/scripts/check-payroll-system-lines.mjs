// System payslip lines are found by kind, not label; import amounts must be real numbers.
// Run: node --experimental-strip-types scripts/check-payroll-system-lines.mjs
import assert from "node:assert/strict";
import { computePayroll, systemLineAmount, isValidPeriod } from "../src/features/payroll/calc.ts";
import { payrollImportRowSchema } from "../src/features/payroll-import/schema.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("computed OT, loan, tax and SSO lines carry a kind and the same amounts", () => {
  const c = computePayroll({ baseSalary: 30000, overtime: 1200, loan: 2500 });
  assert.equal(systemLineAmount(c, "ot"), 1200);
  assert.equal(systemLineAmount(c, "loan"), 2500);
  assert.equal(systemLineAmount(c, "sso"), 750);
  assert.ok(c.deductions.find((d) => d.kind === "tax"));
});

check("an HR-typed line with a system label is not taken for the system line", () => {
  const c = computePayroll({
    baseSalary: 30000,
    extraDeductions: [{ label: "หักชำระเงินกู้", amount: 2000 }],
    extraEarnings: [{ label: "ค่าล่วงเวลา (OT)", amount: 500 }],
  });
  assert.equal(systemLineAmount(c, "loan"), 0);
  assert.equal(systemLineAmount(c, "ot"), 0);
});

check("a payslip stored before kinds existed still matches by label", () => {
  const old = {
    earnings: [{ label: "เงินเดือน", amount: 30000 }, { label: "ค่าล่วงเวลา (OT)", amount: 800 }],
    deductions: [{ label: "หักชำระเงินกู้", amount: 2500 }],
  };
  assert.equal(systemLineAmount(old, "ot"), 800);
  assert.equal(systemLineAmount(old, "loan"), 2500);
});

check("period must be YYYY-MM", () => {
  assert.equal(isValidPeriod("2026-11"), true);
  assert.equal(isValidPeriod("2026-1"), false);
  assert.equal(isValidPeriod("abc"), false);
});

const row = (amount) => payrollImportRowSchema.safeParse({ employeeCode: "1001", period: "2026-11", label: "โบนัส", type: "earning", amount });

check("import amount: blank, null and text are rejected, numbers and numeric text pass", () => {
  assert.equal(row("").success, false);
  assert.equal(row("   ").success, false);
  assert.equal(row(null).success, false);
  assert.equal(row(undefined).success, false);
  assert.equal(row("abc").success, false);
  assert.equal(row(5000).success, true);
  assert.equal(row("5000").success, true);
  assert.equal(row(0).success, true);
});

check("import amount: negative and absurd amounts are rejected", () => {
  assert.equal(row(-1).success, false);
  assert.equal(row(3_000_000_000).success, false);
  assert.equal(row(10_000_000).success, true);
});

console.log(`\n${n} checks passed`);
