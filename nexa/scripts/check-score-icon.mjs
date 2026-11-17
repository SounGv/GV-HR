// Checks which picture each score gets on the rater's screen, for the 1-3 and 1-5 scales.
// Run: node --experimental-strip-types scripts/check-score-icon.mjs
import assert from "node:assert/strict";
import { scoreIconSrc } from "../src/features/appraisal-round/score-icon.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const pic = (max) => Array.from({ length: max }, (_, i) => scoreIconSrc(i + 1, max).split("/").pop());

check("1-5: wrench, seedling, neutral face, thumbs-up, trophy", () => {
  assert.deepEqual(pic(5), ["wrench.png", "seedling.png", "neutral.png", "thumbs-up.png", "trophy.png"]);
});
check("1-3: wrench, neutral face, thumbs-up (no trophy on a short scale)", () => {
  assert.deepEqual(pic(3), ["wrench.png", "neutral.png", "thumbs-up.png"]);
});
check("1-4: wrench, neutral face, thumbs-up, trophy", () => {
  assert.deepEqual(pic(4), ["wrench.png", "neutral.png", "thumbs-up.png", "trophy.png"]);
});
check("1-2: wrench and thumbs-up", () => {
  assert.deepEqual(pic(2), ["wrench.png", "thumbs-up.png"]);
});
check("the lowest score is always the wrench and every picture is a real file name", () => {
  for (const max of [2, 3, 4, 5]) {
    assert.equal(scoreIconSrc(1, max), "/icons/score/wrench.png");
    for (const f of pic(max)) assert.match(f, /^(wrench|seedling|neutral|thumbs-up|trophy)\.png$/);
  }
});

console.log(`
${n} checks passed`);
