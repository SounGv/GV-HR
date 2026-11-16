// Checks the score shown for one rater's sheet on the tracking page (HR only).
// Run: node --experimental-strip-types scripts/check-rater-sheet.mjs
import assert from "node:assert/strict";
import { sheetPercent } from "../src/features/appraisal-round/rater-sheet.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const qs = [{ id: "q1", answerType: "RATING" }, { id: "q2", answerType: "PARAGRAPH" }, { id: "q3", answerType: "RATING" }];

check("a 1-3 sheet gives 100 for a 3 and 66.67 for a 2, like Favpo's summary score", () => {
  assert.equal(sheetPercent([{ questionId: "q1", value: 3 }], qs, 3), 100);
  assert.equal(sheetPercent([{ questionId: "q1", value: 2 }], qs, 3), 66.67);
  assert.equal(sheetPercent([{ questionId: "q1", value: 1 }], qs, 3), 33.33);
});

check("several rating answers are averaged and text answers are ignored", () => {
  const a = [{ questionId: "q1", value: 4 }, { questionId: "q3", value: 5 }, { questionId: "q2", value: "ดีมาก" }];
  assert.equal(sheetPercent(a, qs, 5), 90);
});

check("no rating answer, no score", () => {
  assert.equal(sheetPercent([], qs, 3), null);
  assert.equal(sheetPercent(null, qs, 3), null);
  assert.equal(sheetPercent([{ questionId: "q2", value: "x" }], qs, 3), null);
});

check("an answer outside the scale or for an unknown question is not counted", () => {
  assert.equal(sheetPercent([{ questionId: "q1", value: 9 }], qs, 3), null);
  assert.equal(sheetPercent([{ questionId: "zz", value: 3 }], qs, 3), null);
  assert.equal(sheetPercent([{ questionId: "q1", value: 0 }, { questionId: "q3", value: 3 }], qs, 3), 100);
});

check("a bad scale gives no score instead of dividing by zero", () => {
  assert.equal(sheetPercent([{ questionId: "q1", value: 3 }], qs, 0), null);
});

console.log(`\n${n} checks passed`);
