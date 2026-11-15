// Checks the year-end reminders on HR's home page (dates and wording).
// Run: node --experimental-strip-types scripts/check-due-soon.mjs
import assert from "node:assert/strict";
import { daysToNewYear, dueSoonItems } from "../src/features/dashboard-people/due-soon-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const base = { year: 2026, month: 11, day: 15, holidaysNextYear: 0, balancePeopleThisYear: 130, balancePeopleNextYear: 0, canSetHolidays: true, canSetLeaveYear: true };

check("days to 1 January count calendar days", () => {
  assert.equal(daysToNewYear(2026, 11, 15), 47);
  assert.equal(daysToNewYear(2026, 12, 31), 1);
  assert.equal(daysToNewYear(2026, 10, 1), 92);
});
check("nothing is shown before October", () => {
  assert.deepEqual(dueSoonItems({ ...base, month: 9 }), []);
});
check("both reminders appear when next year has no holidays and no entitlements", () => {
  const items = dueSoonItems(base);
  assert.deepEqual(items.map((i) => i.key), ["leave-year", "holidays"]);
  assert.equal(items[0].title, "ตั้งสิทธิ์ลาปี 2570");
  assert.match(items[0].sub, /ยังไม่ได้ตั้งให้ใครเลย/);
  assert.equal(items[0].daysLeft, 47);
  assert.equal(items[1].title, "วันหยุดปี 2570 ยังไม่ได้ใส่");
});
check("a partly set year says how far it got, and a finished one disappears", () => {
  const partly = dueSoonItems({ ...base, balancePeopleNextYear: 80, holidaysNextYear: 14 });
  assert.equal(partly.length, 1);
  assert.equal(partly[0].sub, "ตั้งแล้ว 80 จาก 130 คน");
  assert.deepEqual(dueSoonItems({ ...base, balancePeopleNextYear: 130, holidaysNextYear: 14 }), []);
});
check("no entitlements this year means there is no baseline to compare with, so no reminder", () => {
  assert.deepEqual(dueSoonItems({ ...base, balancePeopleThisYear: 0, holidaysNextYear: 14 }), []);
});
check("each reminder only goes to people who can do it", () => {
  assert.deepEqual(dueSoonItems({ ...base, canSetHolidays: false }).map((i) => i.key), ["leave-year"]);
  assert.deepEqual(dueSoonItems({ ...base, canSetLeaveYear: false }).map((i) => i.key), ["holidays"]);
  assert.deepEqual(dueSoonItems({ ...base, canSetHolidays: false, canSetLeaveYear: false }), []);
});
console.log(`${n} checks passed`);
