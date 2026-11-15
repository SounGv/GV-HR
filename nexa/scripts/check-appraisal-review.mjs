// Checks the rules of the review page: grade spread, manager averages, flags beside each person.
// Run: node --experimental-strip-types scripts/check-appraisal-review.mjs
import assert from "node:assert/strict";
import {
  CEILING_MIN_PEOPLE,
  MANAGER_GAP_POINTS,
  MIN_PEOPLE_PER_MANAGER,
  ceilingSummary,
  gradeSpread,
  nearBandEdge,
  personFlags,
  summarizeManagers,
} from "../src/features/appraisal-round/review-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const bands = [
  { label: "ต้องปรับปรุง", minPercent: 0 },
  { label: "เยี่ยม", minPercent: 90 },
  { label: "ดี", minPercent: 75 },
  { label: "พอใช้", minPercent: 60 },
];

check("the spread counts each score in the highest band it reaches, listed from the top band down", () => {
  const s = gradeSpread([95, 90, 89.9, 75, 74.9, 60, 59.9, 0], bands);
  assert.deepEqual(s.counts, [2, 2, 2, 2]); // เยี่ยม, ดี, พอใช้, ต้องปรับปรุง
  assert.equal(s.below, 0);
});
check("a score under every band (lowest band does not start at 0) is counted as below, not lost", () => {
  const s = gradeSpread([80, 50], [{ label: "ดี", minPercent: 75 }, { label: "พอใช้", minPercent: 60 }]);
  assert.deepEqual(s.counts, [1, 0]);
  assert.equal(s.below, 1);
});
check("no people means all zero, and the counts add up to the people given", () => {
  assert.deepEqual(gradeSpread([], bands).counts, [0, 0, 0, 0]);
  const ps = [91, 82, 77, 66, 55, 99, 61];
  const s = gradeSpread(ps, bands);
  assert.equal(s.counts.reduce((a, b) => a + b, 0) + s.below, ps.length);
});
check("near-edge looks at both sides of a boundary and ignores the lowest band's 0", () => {
  assert.equal(nearBandEdge(74.4, bands), true, "0.6 under 75");
  assert.equal(nearBandEdge(75.9, bands), true, "0.9 over 75");
  assert.equal(nearBandEdge(76.0, bands), false, "exactly 1 away is not near");
  assert.equal(nearBandEdge(0.4, bands), false, "the bottom band starts at 0, which is not a boundary to watch");
  assert.equal(nearBandEdge(80, []), false, "no bands, nothing to be near");
});
check("flags: self far above the manager says talk, the gap is self minus manager, missing side gives no gap", () => {
  assert.deepEqual(personFlags(92, 78, 82.2, bands), { gap: 14, talk: true, nearEdge: false });
  assert.deepEqual(personFlags(80, 82, 81.4, bands), { gap: -2, talk: false, nearEdge: false });
  assert.deepEqual(personFlags(null, 82, 82, bands), { gap: null, talk: false, nearEdge: false });
  assert.equal(personFlags(85, 72, 75.9, bands).nearEdge, true);
  assert.equal(personFlags(88, 78, 80, bands).talk, true, "exactly 10 points counts");
});
check("a manager with fewer than the minimum people shows no average", () => {
  const { rows } = summarizeManagers([
    { managerId: "a", name: "ก", percents: [80, 80, 80] },
    { managerId: "b", name: "ข", percents: [70, 90] },
  ]);
  const b = rows.find((r) => r.managerId === "b");
  assert.equal(MIN_PEOPLE_PER_MANAGER, 3);
  assert.deepEqual([b.status, b.average, b.diff, b.count], ["few", null, null, 2]);
});
check("the company average counts the hidden small group too, so hiding never changes the comparison", () => {
  const { companyAverage } = summarizeManagers([
    { managerId: "a", name: "ก", percents: [80, 80, 80] },
    { managerId: "b", name: "ข", percents: [60, 60] },
  ]);
  assert.equal(companyAverage, 72); // (240 + 120) / 5
});
check("a manager more than the gap above or below the company is flagged, within the gap is ok", () => {
  const { rows } = summarizeManagers([
    { managerId: "hi", name: "สูง", percents: [90, 90, 90] },
    { managerId: "mid1", name: "กลาง1", percents: [70, 70, 70] },
    { managerId: "mid2", name: "กลาง2", percents: [70, 70, 70] },
    { managerId: "mid3", name: "กลาง3", percents: [70, 70, 70] },
    { managerId: "lo", name: "ต่ำ", percents: [40, 40, 40] },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.managerId, r]));
  assert.equal(MANAGER_GAP_POINTS, 10);
  assert.equal(by.hi.status, "high");
  assert.equal(by.lo.status, "low");
  assert.equal(by.mid1.status, "ok");
});
check("rows needing a look come first, hidden small groups last", () => {
  const { rows } = summarizeManagers([
    { managerId: "few", name: "น้อย", percents: [80] },
    { managerId: "ok", name: "ปกติ", percents: [80, 80, 80, 80] },
    { managerId: "hi", name: "สูง", percents: [99, 99, 99] },
  ]);
  // company average 87.1: "hi" is 11.9 above (warning), "ok" is 7.1 below (within the gap of 10)
  assert.deepEqual(rows.map((r) => [r.managerId, r.status]), [["hi", "high"], ["ok", "ok"], ["few", "few"]]);
});
check("nobody rated gives no average and no rows, never a divide by zero", () => {
  assert.deepEqual(summarizeManagers([]), { rows: [], companyAverage: null });
  assert.deepEqual(summarizeManagers([{ managerId: "x", name: "ว่าง", percents: [] }]).rows, []);
});
check("the ceiling warning needs enough people and most of them at 100, and works without grade bands", () => {
  assert.deepEqual(ceilingSummary([100, 100, 100, 90, 80, 70]), { count: 3, total: 6, flag: true }); // exactly half
  assert.equal(ceilingSummary([100, 100, 90, 80, 70, 60]).flag, false); // a third
  assert.equal(ceilingSummary([100, 100, 100, 100]).flag, false); // fewer than CEILING_MIN_PEOPLE people: too few to say
  assert.equal(CEILING_MIN_PEOPLE, 5);
  assert.deepEqual(ceilingSummary([]), { count: 0, total: 0, flag: false }); // nobody scored: no divide by zero
  assert.equal(ceilingSummary([99.99, 100]).count, 1); // 99.99 is not the top
});

console.log(`\n${n} checks passed`);
