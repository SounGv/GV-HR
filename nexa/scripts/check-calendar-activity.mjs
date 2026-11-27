// Checks who counts as using the clock-in app on a given day (calendar head-counts and the personal calendar).
// Run: node --experimental-strip-types scripts/check-calendar-activity.mjs
import assert from "node:assert/strict";
import { ACTIVITY_LOOKBACK_DAYS, usedClockInBy } from "../src/features/calendar/attendance-activity.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const day = (iso) => new Date(`${iso}T00:00:00Z`).getTime();

check("someone who first scanned on 20 Nov was not using the app on 10 Nov", () => {
  assert.equal(usedClockInBy(day("2026-11-10"), [day("2026-11-20"), day("2026-11-24")]), false);
  assert.equal(usedClockInBy(day("2026-11-21"), [day("2026-11-20"), day("2026-11-24")]), true);
});
check("a record on the day itself counts", () => {
  assert.equal(usedClockInBy(day("2026-11-20"), [day("2026-11-20")]), true);
});
check("the lookback is 60 days and then lapses", () => {
  assert.equal(ACTIVITY_LOOKBACK_DAYS, 60);
  assert.equal(usedClockInBy(day("2026-11-10"), [day("2026-09-11")]), true);
  assert.equal(usedClockInBy(day("2026-11-10"), [day("2026-09-10")]), false);
  assert.equal(usedClockInBy(day("2026-11-10"), [day("2026-09-09")]), false);
});
check("someone who scanned in August, stopped, and resumed later is not counted in the gap", () => {
  const records = [day("2026-08-01"), day("2026-08-14"), day("2026-11-20")];
  assert.equal(usedClockInBy(day("2026-11-10"), records), false);
  assert.equal(usedClockInBy(day("2026-11-23"), records), true);
});
check("no records at all means not using the app", () => {
  assert.equal(usedClockInBy(day("2026-11-10"), []), false);
});

console.log(`\n${n} checks passed`);
