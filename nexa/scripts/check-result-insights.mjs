// Checks the overview above the evaluation report: bands, top/bottom lists, department summary.
// Run: node --experimental-strip-types scripts/check-result-insights.mjs
import assert from "node:assert/strict";
import { DROP_LOOK_POINTS, SCORE_BANDS, bandIndex, compareRounds, previousRoundOf, summarizeRound, trendOf } from "../src/features/report/result-insights.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const p = (name, percent, department = "A", code = name) => ({ code, name, department, percent });

check("each score falls in the right band, 100 on its own and 99.99 not counted as full marks", () => {
  const at = (x) => SCORE_BANDS[bandIndex(x)].label;
  assert.equal(at(0), "ต่ำกว่า 60");
  assert.equal(at(59.99), "ต่ำกว่า 60");
  assert.equal(at(60), "60-69");
  assert.equal(at(66.67), "60-69");
  assert.equal(at(89.99), "80-89");
  assert.equal(at(90), "90-99");
  assert.equal(at(99.99), "90-99");
  assert.equal(at(100), "100");
});

check("the band counts add up to the number of people", () => {
  const people = [p("a", 100), p("b", 100), p("c", 66.67), p("d", 94.4), p("e", 83.3), p("f", 40)];
  const r = summarizeRound("r1", "รอบ", people);
  assert.deepEqual(r.bands.map((b) => b.count), [1, 1, 0, 1, 1, 2]);
  assert.equal(r.bands.reduce((s, b) => s + b.count, 0), people.length);
  assert.equal(r.atTop, 2);
});

check("average, lowest and highest are rounded to one decimal", () => {
  const r = summarizeRound("r1", "รอบ", [p("a", 100), p("b", 66.67), p("c", 91.67)]);
  assert.equal(r.average, 86.1);
  assert.equal(r.min, 66.7);
  assert.equal(r.max, 100);
});

check("top is highest first with ties in name order, bottom is lowest first, both capped", () => {
  const people = [p("ค", 100), p("ก", 100), p("ข", 100), p("ง", 90), p("จ", 50), p("ฉ", 50)];
  const r = summarizeRound("r1", "รอบ", people, 4);
  assert.deepEqual(r.top.map((x) => x.name), ["ก", "ข", "ค", "ง"]);
  assert.deepEqual(r.bottom.map((x) => x.name), ["จ", "ฉ", "ง", "ก"]); // Thai order: จ comes before ฉ
  assert.equal(r.top.length, 4);
  assert.equal(r.bottom.length, 4);
});

check("a list longer than the people available shows everyone once", () => {
  const r = summarizeRound("r1", "รอบ", [p("a", 80), p("b", 90)], 10);
  assert.equal(r.top.length, 2);
  assert.equal(r.bottom.length, 2);
});

check("departments are grouped with their own average, spread and count at 100", () => {
  const r = summarizeRound("r1", "รอบ", [p("a", 100, "คลัง"), p("b", 80, "คลัง"), p("c", 100, "บัญชี")]);
  assert.deepEqual(r.departments, [
    { name: "คลัง", count: 2, average: 90, min: 80, max: 100, atTop: 1 },
    { name: "บัญชี", count: 1, average: 100, min: 100, max: 100, atTop: 1 },
  ]);
});

check("the lists show scores rounded like the tiles, so 66.67 reads 66.7 in both places", () => {
  const r = summarizeRound("r1", "รอบ", [p("a", 66.67), p("b", 100)]);
  assert.equal(r.min, 66.7);
  assert.equal(r.bottom[0].percent, 66.7);
  assert.equal(r.top[0].percent, 100);
});

check("people tied past the end of a list are counted, so a long tie is never mistaken for a complete list", () => {
  const tie = Array.from({ length: 12 }, (_, i) => p(`ก${i}`, 66.67));
  const r = summarizeRound("r1", "รอบ", [...tie, p("x", 100)], 10);
  assert.equal(r.bottom.length, 10);
  assert.equal(r.bottomTied, 2); // 12 share the lowest score, 10 are shown
  assert.equal(r.topTied, 3); // the top 10 is the single 100 plus 9 of the 12 tied at 66.67, so 3 of those are not shown
  assert.equal(summarizeRound("r1", "รอบ", [p("a", 80), p("b", 90)], 10).bottomTied, 0);
});

check("a round with nobody in it gives zeros and empty lists, never NaN or a crash", () => {
  const r = summarizeRound("r1", "รอบ", []);
  assert.equal(r.count, 0);
  assert.equal(r.average, 0);
  assert.equal(r.min, 0);
  assert.equal(r.max, 0);
  assert.deepEqual([r.top, r.bottom, r.departments], [[], [], []]);
  assert.equal(r.topTied + r.bottomTied, 0);
  assert.ok(r.bands.every((b) => b.count === 0));
});

const manager = [p("a", 100, "คลัง", "1"), p("b", 80, "คลัง", "2"), p("c", 60, "ขนส่ง", "3"), p("d", 90, "ขนส่ง", "4")];
const managerBefore = [p("a", 90, "คลัง", "1"), p("b", 80, "คลัง", "2"), p("c", 70, "ขนส่ง", "3"), p("d", 91, "ขนส่ง", "4")];
const staffOther = [p("x", 80, "คลัง", "9"), p("y", 80, "คลัง", "8")];

check("the round compared with is the older one that shares most people, and a round that asks other people is never picked", () => {
  const rounds = [summarizeRound("now", "ต.ค.", manager), summarizeRound("other", "ลูกน้องประเมินหัวหน้า", staffOther), summarizeRound("before", "ก.ย.", managerBefore)];
  assert.equal(previousRoundOf(rounds, "now")?.id, "before");
  assert.equal(previousRoundOf(rounds, "before"), undefined);
  assert.equal(previousRoundOf([rounds[0], rounds[1]], "now"), undefined);
});

check("the comparison gives the average change, each department, the drops and the rises", () => {
  const c = compareRounds(summarizeRound("now", "ต.ค.", manager), summarizeRound("before", "ก.ย.", managerBefore));
  assert.equal(c.shared, 4);
  assert.equal(c.averageDelta, -0.3);
  assert.deepEqual(c.drops.map((x) => [x.name, x.delta]), [["c", -10]]);
  assert.deepEqual(c.rises.map((x) => [x.name, x.delta]), [["a", 10]]);
  assert.equal(c.departments.find((d) => d.name === "คลัง").delta, 5);
  assert.equal(DROP_LOOK_POINTS, 5);
});

check("a change of 3 points or more counts as better or worse, less than that as the same", () => {
  assert.equal(trendOf(3), "up");
  assert.equal(trendOf(2.9), "same");
  assert.equal(trendOf(-3), "down");
  assert.equal(trendOf(0), "same");
});

console.log(`\n${n} checks passed`);
