// Pure check for splitStackedMarks(): node --experimental-strip-types scripts/check-thai-marks.mjs
import assert from "node:assert/strict";
import { splitStackedMarks } from "../src/lib/thai-marks.ts";

const m = (at, mark, raise, shiftLeft) => ({ at, mark, raise, shiftLeft });
// Tone over an upper vowel is lifted out and drawn raised after the vowel.
assert.deepEqual(splitStackedMarks("ที่"), { base: "ที", marks: [m(2, "่", true, false)] });
// Tone straight on a short consonant prints normally.
assert.deepEqual(splitStackedMarks("ก้า"), { base: "ก้า", marks: [] });
// On a tall consonant every above-mark moves left; over its upper vowel the tone is also raised.
assert.deepEqual(splitStackedMarks("ป่า"), { base: "ปา", marks: [m(1, "่", false, true)] });
assert.deepEqual(splitStackedMarks("ปู่"), { base: "ปู", marks: [m(2, "่", false, true)] });
assert.deepEqual(splitStackedMarks("ฟี่"), { base: "ฟ", marks: [m(1, "ี", false, true), m(1, "่", true, true)] });
// Before sara am the tone is raised (ำ carries its own circle on top).
assert.deepEqual(splitStackedMarks("น้ำ"), { base: "นำ", marks: [m(1, "้", true, false)] });
// Several in one line keep their own positions.
const r = splitStackedMarks("ญี่ปุ่น ทั้ง");
assert.equal(r.base, "ญีปุน ทัง");
assert.deepEqual(r.marks, [m(2, "่", true, false), m(4, "่", false, true), m(8, "้", true, false)]);
assert.deepEqual(splitStackedMarks("ABC 123"), { base: "ABC 123", marks: [] });
console.log("thai marks ok");
