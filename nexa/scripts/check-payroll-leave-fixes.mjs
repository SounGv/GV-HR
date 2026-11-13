// Checks the payroll and leave fixes from the 2026-11-13 system check, with made-up data only.
// Run: node --experimental-strip-types scripts/check-payroll-leave-fixes.mjs
import assert from "node:assert/strict";
import { leaveDaysWithin, timeRangesOverlap } from "../src/features/leave/days.ts";
import { unpaidHoursCharged } from "../src/features/payroll/calc.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const d = (s) => new Date(`${s}T00:00:00Z`);
// Bangkok wall clock → instant (UTC+7).
const bkk = (date, time) => new Date(new Date(`${date}T${time}:00Z`).getTime() - 7 * 3_600_000);

check("leave Fri 30 Oct - Tue 3 Nov 2026 splits 2 + 2 (Sunday 1 Nov not counted)", () => {
  assert.equal(
    leaveDaysWithin(d("2026-10-30"), d("2026-11-03"), d("2026-10-01"), d("2026-11-01")),
    2,
  );
  assert.equal(
    leaveDaysWithin(d("2026-10-30"), d("2026-11-03"), d("2026-11-01"), d("2026-12-01")),
    2,
  );
});
check("leave entirely outside a period counts 0", () => {
  assert.equal(
    leaveDaysWithin(d("2026-12-02"), d("2026-12-03"), d("2026-11-01"), d("2026-12-01")),
    0,
  );
});
check("same-day time ranges: overlap, touching and apart", () => {
  assert.equal(timeRangesOverlap("09:00", "11:00", "10:00", "12:00"), true);
  assert.equal(timeRangesOverlap("09:00", "10:00", "10:00", "11:00"), false);
  assert.equal(timeRangesOverlap("09:00", "10:00", "13:00", "14:00"), false);
});
const base = { hours: 2, date: "2026-11-12", startTime: "15:00", endTime: "17:00" };
check("monthly staff: every approved unpaid hour is charged", () => {
  assert.equal(
    unpaidHoursCharged({ ...base, pay: "MONTHLY", clockInAt: null, clockOutAt: null }),
    2,
  );
});
check("daily staff: charged on a day with a clock-in, not on a day without", () => {
  assert.equal(
    unpaidHoursCharged({
      ...base,
      pay: "DAILY",
      clockInAt: bkk("2026-11-12", "08:00"),
      clockOutAt: null,
    }),
    2,
  );
  assert.equal(unpaidHoursCharged({ ...base, pay: "DAILY", clockInAt: null, clockOutAt: null }), 0);
});
check("hourly staff who left at 15:00 for a 15:00-17:00 leave lose nothing more", () => {
  assert.equal(
    unpaidHoursCharged({
      ...base,
      pay: "HOURLY",
      clockInAt: bkk("2026-11-12", "08:00"),
      clockOutAt: bkk("2026-11-12", "15:00"),
    }),
    0,
  );
});
check("hourly staff who stayed clocked in through the leave are charged the overlap", () => {
  assert.equal(
    unpaidHoursCharged({
      ...base,
      pay: "HOURLY",
      clockInAt: bkk("2026-11-12", "08:00"),
      clockOutAt: bkk("2026-11-12", "16:00"),
    }),
    1,
  );
});

console.log(`\n${n} checks passed`);
