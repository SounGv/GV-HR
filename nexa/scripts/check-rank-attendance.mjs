// Pure check for rankAttendance(): node --experimental-strip-types scripts/check-rank-attendance.mjs
import assert from "node:assert/strict";
import { rankAttendance, toAttendanceRow } from "../src/features/ai/rank-attendance.ts";

const row = (name, absent, late, leave, present = 5) => toAttendanceRow({ code: name, name, scheduled: 8, present, rate: 0, late, leave, absent });
const out = rankAttendance([
  row("ก", 1, 5, 0),
  row("ข", 3, 0, 0),
  row("ค", 1, 5, 2),
  row("ง", 0, 0, 0, 0), // never scanned: bottom, unranked
  row("จ", 1, 2, 0),
]);
assert.deepEqual(out.map((r) => r.name), ["ข", "ค", "ก", "จ", "ง"]);
assert.deepEqual(out.map((r) => r.rank), [1, 2, 3, 4, null]);
assert.match(out[4].note, /ไม่มีบันทึกสแกน/);
// String numbers from the API are treated as numbers.
assert.equal(toAttendanceRow({ absent: "2.5" }).absent, 2.5);
console.log("rank attendance ok");
