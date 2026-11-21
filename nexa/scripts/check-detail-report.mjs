// Checks the pure helpers of the detailed evaluation report.
// Run: node --experimental-strip-types scripts/check-detail-report.mjs
import assert from "node:assert/strict";
import { deltaOf, meanOf, previousDepartmentMean, previousScore, ranksFor, sectionPercents, toneOf, monthLabelFromName } from "../src/features/appraisal-round/detail-report-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a round's month is read from its name when it starts with a Thai month and year", () => {
  assert.equal(monthLabelFromName("กันยายน 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)"), "ก.ย. 69");
  assert.equal(monthLabelFromName("พฤศจิกายน 2569 ลูกน้องประเมินหัวหน้า"), "พ.ย. 69");
  assert.equal(monthLabelFromName("รอบประเมินใหม่"), null);
  assert.equal(monthLabelFromName("แม่แบบ หัวหน้าประเมินลูกน้อง"), null);
});

check("score colour groups follow the HR sheets: 100, 90-99, 80-89, below 80", () => {
  assert.equal(toneOf(100), "full");
  assert.equal(toneOf(99.99), "high");
  assert.equal(toneOf(90), "high");
  assert.equal(toneOf(89.9), "mid");
  assert.equal(toneOf(80), "mid");
  assert.equal(toneOf(79.99), "low");
  assert.equal(toneOf(0), "low");
});

check("mean is rounded to one decimal and empty is null", () => {
  assert.equal(meanOf([100, 80, 90]), 90);
  assert.equal(meanOf([86, 87]), 86.5);
  assert.equal(meanOf([]), null);
});

check("equal scores share a rank and the next one skips", () => {
  assert.deepEqual(ranksFor([100, 90, 100, 80]), [1, 3, 1, 4]);
  assert.deepEqual(ranksFor([]), []);
});

check("a change needs both sides", () => {
  assert.equal(deltaOf(86.4, 83.3), 3.1);
  assert.equal(deltaOf(70, 80), -10);
  assert.equal(deltaOf(70, null), null);
  assert.equal(deltaOf(null, 80), null);
});

const rounds = [{ id: "r1", at: 1 }, { id: "r2", at: 2 }, { id: "r3", at: 3 }];
const rows = [
  { roundId: "r1", employeeId: "a", department: "X", score: 70 },
  { roundId: "r1", employeeId: "b", department: "X", score: 90 },
  { roundId: "r3", employeeId: "a", department: "X", score: 85 },
];

check("the previous score is the nearest earlier round the person was scored in", () => {
  assert.equal(previousScore(rows, rounds, "r3", "a"), 70);
  assert.equal(previousScore(rows, rounds, "r1", "a"), null);
  assert.equal(previousScore(rows, rounds, "r3", "zz"), null);
  assert.equal(previousScore(rows, rounds, "nope", "a"), null);
});

check("the previous department mean skips rounds where the department has nobody", () => {
  assert.equal(previousDepartmentMean(rows, rounds, "r3", "X"), 80);
  assert.equal(previousDepartmentMean(rows, rounds, "r3", "Y"), null);
});

check("section percents average rating answers per section and ignore text and out-of-range values", () => {
  const qs = [
    { id: "q1", answerType: "RATING", section: "ผลงาน" },
    { id: "q2", answerType: "RATING", section: "ผลงาน" },
    { id: "q3", answerType: "RATING", section: null },
    { id: "q4", answerType: "PARAGRAPH", section: "ผลงาน" },
  ];
  const m = sectionPercents(qs, [[{ questionId: "q1", value: 5 }, { questionId: "q2", value: 3 }, { questionId: "q3", value: 4 }, { questionId: "q4", value: "x" }, { questionId: "q1", value: 9 }]], 5);
  assert.equal(m.get("ผลงาน"), 80);
  assert.equal(m.get("ทั่วไป"), 80);
  assert.equal(m.size, 2);
});

console.log(`\n${n} checks passed`);
