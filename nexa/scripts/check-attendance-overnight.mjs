// Checks for clock-out after midnight: early-leave from elapsed minutes and the open-session window.
// Run: node --experimental-strip-types scripts/check-attendance-overnight.mjs
import assert from "node:assert/strict";
import {
  isEarlyLeaveElapsed,
  isOpenSessionCurrent,
  minutesSinceWorkDate,
  shiftEndFromWorkDateStart,
} from "../src/features/attendance/overnight.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const GRACE = 5;
const day = { startMin: 540, endMin: 1080 }; // 09:00-18:00
const night = { startMin: 1320, endMin: 360 }; // 22:00-06:00
// workDate is UTC midnight of the Bangkok date; Bangkok 2026-11-10 00:00 is 2026-11-09T17:00Z.
const workDate = new Date("2026-11-10T00:00:00Z");
const bkk = (iso) => new Date(`${iso}+07:00`);

check("elapsed minutes on the same day equal the minute of day", () => {
  assert.equal(minutesSinceWorkDate(bkk("2026-11-10T17:55:30"), workDate), 17 * 60 + 55);
});
check("elapsed minutes after midnight run past 1440", () => {
  assert.equal(minutesSinceWorkDate(bkk("2026-11-11T00:30:00"), workDate), 1470);
});
check("day shift: shift end is unchanged", () => {
  assert.equal(shiftEndFromWorkDateStart(day), 1080);
});
check("night shift: shift end moves to the next day", () => {
  assert.equal(shiftEndFromWorkDateStart(night), 1800);
});
check("day shift keeps today's rule: 17:54 is early, 17:55 is not", () => {
  assert.equal(isEarlyLeaveElapsed(17 * 60 + 54, day, GRACE), true);
  assert.equal(isEarlyLeaveElapsed(17 * 60 + 55, day, GRACE), false);
});
check("day shift clock-out at 00:30 the next day is not early", () => {
  assert.equal(isEarlyLeaveElapsed(1470, day, GRACE), false);
});
check("night shift clock-out at 06:00 is not early, 02:00 is", () => {
  assert.equal(isEarlyLeaveElapsed(minutesSinceWorkDate(bkk("2026-11-11T06:00:00"), workDate), night, GRACE), false);
  assert.equal(isEarlyLeaveElapsed(minutesSinceWorkDate(bkk("2026-11-11T02:00:00"), workDate), night, GRACE), true);
});
check("shift ending at midnight (16:00-00:00) ends at 1440", () => {
  assert.equal(shiftEndFromWorkDateStart({ startMin: 960, endMin: 0 }), 1440);
});
check("a night shift clocked in 22:00 is still current at 06:00", () => {
  assert.equal(isOpenSessionCurrent(bkk("2026-11-10T22:00:00"), bkk("2026-11-11T06:00:00")), true);
});
check("a day shift left open at 09:00 is not current at 08:00 the next morning", () => {
  assert.equal(isOpenSessionCurrent(bkk("2026-11-10T09:00:00"), bkk("2026-11-11T08:00:00")), false);
});
check("a day shift left open is still current for OT at 00:30", () => {
  assert.equal(isOpenSessionCurrent(bkk("2026-11-10T09:00:00"), bkk("2026-11-11T00:30:00")), true);
});
console.log(`${n} checks passed`);
