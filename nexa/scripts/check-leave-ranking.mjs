// Checks the leave ranking quick answer: totals, split by type, ties and the typed command.
// Run: node --experimental-strip-types scripts/check-leave-ranking.mjs
import assert from "node:assert/strict";
import { LEAVE_RANK_DEFAULT, LEAVE_RANK_MAX, clampTop, dayText, rankLeave } from "../src/features/ai/leave-ranking.ts";
import { parseQuickCommand } from "../src/features/ai/quick-actions.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const r = (employeeId, name, typeLabel, days, department = "คลัง") => ({ employeeId, name, department, typeLabel, days });

check("people are ranked by total days, with the split by type biggest first", () => {
  const out = rankLeave([r("a", "ก", "ลาป่วย", 3), r("a", "ก", "ลากิจ", 1.5), r("b", "ข", "ลาพักร้อน", 6), r("c", "ค", "ลาป่วย", 2)], 5);
  assert.deepEqual(out.lines.map((x) => [x.name, x.totalDays]), [["ข", 6], ["ก", 4.5], ["ค", 2]]);
  assert.equal(out.lines[1].breakdown, "ลาป่วย 3, ลากิจ 1.5");
  assert.equal(out.people, 3);
});

check("only the top N are listed, and a tie with the last one is counted instead of hidden", () => {
  const rows = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช"].map((x, i) => r(x, x, "ลาป่วย", i < 4 ? 10 - i : 5));
  const out = rankLeave(rows, 5);
  assert.equal(out.lines.length, 5);
  assert.equal(out.people, 7);
  assert.equal(out.tiedBeyond, 2); // จ, ฉ, ช all have 5; one of them fits, two do not
});

check("a longer list than people shows everyone once and says nothing about ties", () => {
  const out = rankLeave([r("a", "ก", "ลาป่วย", 1)], 10);
  assert.equal(out.lines.length, 1);
  assert.equal(out.tiedBeyond, 0);
});

check("nobody on leave gives an empty list, never a crash", () => {
  const out = rankLeave([], 5);
  assert.deepEqual([out.lines, out.people, out.tiedBeyond], [[], 0, 0]);
});

check("rows with no days (hourly leave) are not counted", () => {
  const out = rankLeave([r("a", "ก", "ลาป่วย", 0), r("b", "ข", "ลากิจ", 1)], 5);
  assert.deepEqual(out.lines.map((x) => x.name), ["ข"]);
});

check("names that tie are in Thai name order", () => {
  const out = rankLeave([r("1", "ค", "ลาป่วย", 2), r("2", "ก", "ลาป่วย", 2)], 5);
  assert.deepEqual(out.lines.map((x) => x.name), ["ก", "ค"]);
});

check("the number asked for is kept between 1 and the maximum, default 5", () => {
  assert.equal(clampTop(undefined), LEAVE_RANK_DEFAULT);
  assert.equal(clampTop(0), LEAVE_RANK_DEFAULT);
  assert.equal(clampTop(3), 3);
  assert.equal(clampTop(500), LEAVE_RANK_MAX);
});

check("days show with at most one decimal and no trailing .0", () => {
  assert.equal(dayText(3), "3");
  assert.equal(dayText(1.5), "1.5");
  assert.equal(dayText(2.04), "2");
});

check("the command is read in the ways people type it, and only those", () => {
  assert.deepEqual(parseQuickCommand("ปีนี้ใครลาเยอะสุด 5 อันดับ แยกประเภทลา"), { action: "leave_ranking", count: 5 });
  assert.deepEqual(parseQuickCommand("ใครลาเยอะสุดปีนี้"), { action: "leave_ranking" });
  assert.deepEqual(parseQuickCommand("ลาเยอะสุด 10 อันดับ"), { action: "leave_ranking", count: 10 });
  assert.deepEqual(parseQuickCommand("ใครลาบ่อยสุด"), { action: "leave_ranking" });
  assert.equal(parseQuickCommand("ใครลาเยอะสุดในแผนกคลัง"), null, "extra words are not guessed");
  assert.equal(parseQuickCommand("สมชายลาเยอะสุดไหมในปีที่แล้ว"), null);
});

console.log(`\n${n} checks passed`);
