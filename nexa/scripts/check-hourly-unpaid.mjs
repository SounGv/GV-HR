// Checks hourly unpaid leave: who may take it, the hourly value per pay type, and what payroll takes off.
// Run: node --experimental-strip-types scripts/check-hourly-unpaid.mjs
import assert from "node:assert/strict";
import { canTakeHourly } from "../src/features/leave/days.ts";
import { computePayroll, unpaidHourRate } from "../src/features/payroll/calc.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const line = (comp, prefix) => comp.deductions.find((d) => d.label.startsWith(prefix));
const PAY = ["MONTHLY", "DAILY", "HOURLY", null, undefined];

check("sick, personal and unpaid leave can be taken by the hour by everyone", () => {
  for (const pay of PAY) {
    for (const t of ["SICK", "PERSONAL", "UNPAID"])
      assert.equal(canTakeHourly(t, pay), true, `${t} ${pay}`);
  }
});
check("annual leave and the other types stay day-only", () => {
  for (const pay of PAY) {
    for (const t of ["ANNUAL", "OTHER", "HOLIDAY_SWAP"])
      assert.equal(canTakeHourly(t, pay), false, `${t} ${pay}`);
  }
});
check("one unpaid hour is worth: daily rate ÷ 8, the hourly rate, or salary ÷ 30 ÷ 8", () => {
  assert.equal(
    unpaidHourRate({
      compensationType: "DAILY",
      baseSalary: null,
      dailyRate: 400,
      hourlyRate: null,
    }),
    50,
  );
  assert.equal(
    unpaidHourRate({
      compensationType: "HOURLY",
      baseSalary: null,
      dailyRate: null,
      hourlyRate: 60,
    }),
    60,
  );
  assert.equal(
    unpaidHourRate({
      compensationType: "MONTHLY",
      baseSalary: 30000,
      dailyRate: null,
      hourlyRate: null,
    }),
    125,
  );
  assert.equal(
    unpaidHourRate({
      compensationType: "DAILY",
      baseSalary: null,
      dailyRate: null,
      hourlyRate: null,
    }),
    0,
  );
});
check("daily rate 400, 20 days worked, 1 hour unpaid: full days paid, 50 taken off", () => {
  const comp = computePayroll({
    baseSalary: 8000,
    compensationType: "DAILY",
    unpaidLeaveHours: 1,
    unpaidLeaveHourRate: 50,
  });
  assert.equal(comp.gross, 8000);
  assert.deepEqual(line(comp, "หักลาไม่รับค่าจ้าง"), {
    label: "หักลาไม่รับค่าจ้าง (1 ชม.)",
    amount: 50,
  });
  assert.equal(comp.net, 8000 - comp.totalDeductions);
});
check("monthly 30,000 with 2 unpaid hours: 250 taken off, beside a full unpaid day's 1,000", () => {
  const comp = computePayroll({
    baseSalary: 30000,
    unpaidLeaveDays: 1,
    unpaidLeaveHours: 2,
    unpaidLeaveHourRate: 125,
  });
  assert.deepEqual(
    comp.deductions.filter((d) => d.label.startsWith("หักลาไม่รับค่าจ้าง")),
    [
      { label: "หักลาไม่รับค่าจ้าง", amount: 1000 },
      { label: "หักลาไม่รับค่าจ้าง (2 ชม.)", amount: 250 },
    ],
  );
});
check("several requests add up (2 + 1.5 hours at 380 a day = 166.25 → 166)", () => {
  const comp = computePayroll({
    baseSalary: 3800,
    compensationType: "DAILY",
    unpaidLeaveHours: 3.5,
    unpaidLeaveHourRate: 380 / 8,
  });
  assert.deepEqual(line(comp, "หักลาไม่รับค่าจ้าง"), {
    label: "หักลาไม่รับค่าจ้าง (3.5 ชม.)",
    amount: 166,
  });
});
check("no unpaid hours: payslips are exactly as before", () => {
  const before = computePayroll({ baseSalary: 30000, unpaidLeaveDays: 1 });
  const after = computePayroll({
    baseSalary: 30000,
    unpaidLeaveDays: 1,
    unpaidLeaveHours: 0,
    unpaidLeaveHourRate: 125,
  });
  assert.deepEqual(after, before);
});

console.log(`\n${n} checks passed`);
