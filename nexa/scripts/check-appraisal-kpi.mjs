// Checks the pure KPI rules with made-up numbers only.
// Run: node --experimental-strip-types scripts/check-appraisal-kpi.mjs
import assert from "node:assert/strict";
import { bandFor, indicatorPoints, kpiScore, profileProblems } from "../src/features/appraisal-kpi/rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const lateSteps = [{ limit: 0, points: 100 }, { limit: 2, points: 70 }, { limit: 5, points: 30 }];

check("lower is better: the first step the value fits wins, beyond the last step earns 0", () => {
  assert.equal(indicatorPoints(lateSteps, 0, false), 100);
  assert.equal(indicatorPoints(lateSteps, 2, false), 70);
  assert.equal(indicatorPoints(lateSteps, 3, false), 30);
  assert.equal(indicatorPoints(lateSteps, 6, false), 0);
});
check("steps work whatever order they were typed in", () => {
  assert.equal(indicatorPoints([...lateSteps].reverse(), 1, false), 70);
});
check("higher is better: the highest limit reached wins", () => {
  const rate = [{ limit: 95, points: 100 }, { limit: 90, points: 60 }];
  assert.equal(indicatorPoints(rate, 97, true), 100);
  assert.equal(indicatorPoints(rate, 92, true), 60);
  assert.equal(indicatorPoints(rate, 80, true), 0);
});
check("the total scales each indicator by its weight", () => {
  const r = kpiScore(
    [
      { metric: "late", weight: 60, steps: lateSteps },
      { metric: "rate", weight: 40, steps: [{ limit: 95, points: 100 }] },
    ],
    { late: 2, rate: 96 },
  );
  assert.equal(r.score, 82); // 60 * 0.7 + 40 * 1
  assert.equal(r.parts.length, 2);
});
check("a missing value counts as zero and an unknown metric is skipped", () => {
  const r = kpiScore([{ metric: "late", weight: 100, steps: lateSteps }, { metric: "nope", weight: 0, steps: [] }], {});
  assert.equal(r.score, 100);
  assert.equal(r.parts.length, 1);
});
check("band: the highest band reached", () => {
  const bands = [{ label: "แดง", min: 0, tone: "red" }, { label: "เหลือง", min: 60, tone: "yellow" }, { label: "เขียว", min: 85, tone: "green" }];
  assert.equal(bandFor(90, bands).label, "เขียว");
  assert.equal(bandFor(70, bands).label, "เหลือง");
  assert.equal(bandFor(10, bands).label, "แดง");
  assert.equal(bandFor(10, [{ label: "เขียว", min: 85, tone: "green" }]), null);
});
check("a profile needs indicators, weights totalling 100, steps and sane bands", () => {
  const ok = [{ metric: "late", weight: 100, steps: lateSteps }];
  assert.deepEqual(profileProblems(ok, []), []);
  assert.ok(profileProblems([], []).length);
  assert.ok(profileProblems([{ metric: "late", weight: 60, steps: lateSteps }], []).some((p) => p.includes("100")));
  assert.ok(profileProblems([{ metric: "late", weight: 100, steps: [] }], []).some((p) => p.includes("เกณฑ์")));
  assert.ok(profileProblems([{ metric: "late", weight: 50, steps: lateSteps }, { metric: "late", weight: 50, steps: lateSteps }], []).some((p) => p.includes("ซ้ำ")));
  assert.ok(profileProblems(ok, [{ label: "", min: 50, tone: "green" }]).length);
});

console.log(`\n${n} checks passed`);
