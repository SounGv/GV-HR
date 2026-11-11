// Pure check for rating-labels: node --experimental-strip-types scripts/check-rating-labels.mjs
import assert from "node:assert/strict";
import { LABEL_PRESETS, parseRatingLabels, presetOf, rubricFor } from "../src/features/appraisal-form/rating-labels.ts";

const hr = LABEL_PRESETS.hr.labels;
// A stored set round-trips and shows best score first.
assert.deepEqual(parseRatingLabels(hr, 5), hr);
assert.deepEqual(rubricFor(5, hr).map((r) => `${r.score} ${r.label}`), ["5 ดีมาก", "4 ดี", "3 ปานกลาง", "2 พอใช้", "1 ปรับปรุง"]);
// No names, bad names or a missing score fall back to the system set (a form saved before this feature).
assert.equal(rubricFor(5, null)[0].label, "ดีเยี่ยม");
assert.equal(parseRatingLabels([{ score: 1, label: "ก" }], 5), null);
assert.equal(parseRatingLabels([...hr.slice(0, 4), { score: 5, label: "  " }], 5), null);
assert.equal(parseRatingLabels("nope", 5), null);
// Presets are recognised; anything else is custom; null is the system set.
assert.equal(presetOf(hr), "hr");
assert.equal(presetOf(LABEL_PRESETS.clear.labels), "clear");
assert.equal(presetOf(hr.map((l) => (l.score === 3 ? { ...l, label: "กลางๆ" } : l))), "custom");
assert.equal(presetOf(null), null);
console.log("rating labels ok");
