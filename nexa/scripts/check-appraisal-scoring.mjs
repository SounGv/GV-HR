// Checks the pure scoring rules with made-up questions and answers only.
// Run: node --experimental-strip-types scripts/check-appraisal-scoring.mjs
import assert from "node:assert/strict";
import { bandsProblem, computeResult, gradeFor, raterPercent } from "../src/features/appraisal-round/scoring.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const Q = [
  { id: "a", answerType: "RATING", weight: 2, visibleTo: [] },
  { id: "b", answerType: "RATING", weight: 1, visibleTo: [] },
  { id: "c", answerType: "RATING", weight: 1, visibleTo: ["MANAGER"] },
  { id: "t", answerType: "PARAGRAPH", weight: 0, visibleTo: [] },
];
const ans = (...pairs) => pairs.map(([questionId, value]) => ({ questionId, value }));

check("weighted: a rater's percentage is weight × (score / top) over the answered ratings", () => {
  // a=5/5 (w2), b=3/5 (w1) -> (2*1 + 1*0.6) / 3 = 86.67
  assert.equal(Math.round(raterPercent(Q, "SELF", ans(["a", 5], ["b", 3]), 5, "WEIGHTED") * 100) / 100, 86.67);
});
check("simple: every rating counts the same", () => {
  assert.equal(raterPercent(Q, "SELF", ans(["a", 5], ["b", 3]), 5, "SIMPLE"), 80);
});
check("text answers, unknown questions and out-of-scale scores are ignored", () => {
  assert.equal(raterPercent(Q, "SELF", ans(["t", "ดี"], ["ghost", 5], ["a", 9], ["b", 0]), 5, "WEIGHTED"), null);
});
check("a question hidden from this rater type does not count", () => {
  assert.equal(raterPercent(Q, "SELF", ans(["c", 5]), 5, "WEIGHTED"), null);
  assert.equal(raterPercent(Q, "MANAGER", ans(["c", 5]), 5, "WEIGHTED"), 100);
});

check("overall: perspectives are weighted and the number is a percentage of the top score", () => {
  const r = computeResult({
    questions: Q,
    ratingMax: 5,
    raters: [
      { raterType: "MANAGER", answers: ans(["a", 4], ["b", 4]) }, // 80
      { raterType: "SELF", answers: ans(["a", 5], ["b", 5]) }, // 100
    ],
    perspectiveWeights: { MANAGER: 70, SELF: 30 },
    mode: "WEIGHTED",
    bands: [{ label: "ดี", minPercent: 75 }, { label: "ดีเยี่ยม", minPercent: 90 }],
  });
  assert.equal(r.scorePercent, 86);
  assert.equal(r.overallScore, 4.3);
  assert.equal(r.grade, "ดี");
});
check("several raters of one type are averaged first", () => {
  const r = computeResult({
    questions: Q,
    ratingMax: 5,
    raters: [
      { raterType: "PEER", answers: ans(["a", 5], ["b", 5]) },
      { raterType: "PEER", answers: ans(["a", 3], ["b", 3]) },
    ],
    perspectiveWeights: { PEER: 100 },
    mode: "WEIGHTED",
  });
  assert.equal(r.scorePercent, 80);
  assert.equal(r.types[0].raters, 2);
});
check("a perspective with no answers is left out and the others are re-balanced", () => {
  const r = computeResult({
    questions: Q,
    ratingMax: 5,
    raters: [{ raterType: "MANAGER", answers: ans(["a", 4], ["b", 4]) }],
    perspectiveWeights: { MANAGER: 70, SELF: 30 },
    mode: "WEIGHTED",
  });
  assert.equal(r.scorePercent, 80);
  assert.equal(r.types[0].weightUsed, 100);
});
check("if the answering perspectives have no weight they count equally", () => {
  const r = computeResult({
    questions: Q,
    ratingMax: 5,
    raters: [
      { raterType: "MANAGER", answers: ans(["a", 5], ["b", 5]) },
      { raterType: "SELF", answers: ans(["a", 3], ["b", 3]) },
    ],
    perspectiveWeights: {},
    mode: "WEIGHTED",
  });
  assert.equal(r.scorePercent, 80);
});
check("nobody has rated anything yet gives no result", () => {
  assert.equal(computeResult({ questions: Q, ratingMax: 5, raters: [{ raterType: "SELF", answers: [] }], perspectiveWeights: {}, mode: "WEIGHTED" }), null);
});

check("grade: the highest band reached, none when no bands or below all of them", () => {
  const bands = [{ label: "ควรปรับปรุง", minPercent: 0 }, { label: "ดี", minPercent: 75 }, { label: "ดีเยี่ยม", minPercent: 90 }];
  assert.equal(gradeFor(90, bands), "ดีเยี่ยม");
  assert.equal(gradeFor(89.9, bands), "ดี");
  assert.equal(gradeFor(10, bands), "ควรปรับปรุง");
  assert.equal(gradeFor(50, []), null);
  assert.equal(gradeFor(50, [{ label: "ดี", minPercent: 75 }]), null);
});
check("bands need a name, 0-100 and distinct starting points", () => {
  assert.equal(bandsProblem([{ label: "ดี", minPercent: 75 }]), null);
  assert.ok(bandsProblem([{ label: " ", minPercent: 75 }]));
  assert.ok(bandsProblem([{ label: "ก", minPercent: 101 }]));
  assert.ok(bandsProblem([{ label: "ก", minPercent: 50 }, { label: "ข", minPercent: 50 }]));
});

console.log(`\n${n} checks passed`);
