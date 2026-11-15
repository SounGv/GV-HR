// Checks the rules of recurring rounds: which period a round is for, when its draft is due, how it is named.
// Run: node --experimental-strip-types scripts/check-appraisal-recurrence.mjs
import assert from "node:assert/strict";
import {
  DRAFT_LEAD_DAYS,
  checkRecurrence,
  dueOccurrences,
  occurrencesBetween,
  roundName,
  upcomingOccurrences,
} from "../src/features/appraisal-round/recurrence-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const monthly = { frequency: "MONTHLY", openDay: 1, closeDay: 7 };
const keys = (os) => os.map((o) => o.periodKey);

check("a monthly round opening on 1 December is for November, and the next ones follow in order", () => {
  const up = upcomingOccurrences("2026-11-15", monthly, 3);
  assert.deepEqual(keys(up), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(up.map((o) => [o.startIso, o.endIso]), [["2026-12-01", "2026-12-07"], ["2027-01-01", "2027-01-07"], ["2027-02-01", "2027-02-07"]]);
});
check("the round opening in January is for December of the year before, in Buddhist years", () => {
  const jan = upcomingOccurrences("2026-11-15", monthly, 3)[1];
  assert.equal(jan.monthText, "ธันวาคม");
  assert.equal(jan.yearText, "2569");
  assert.equal(upcomingOccurrences("2026-11-15", monthly, 3)[2].yearText, "2570", "the round opening in February 2027 is for January 2027 (พ.ศ. 2570)");
});
check("the pattern fills month, quarter and year from the period being evaluated", () => {
  const o = upcomingOccurrences("2026-11-15", monthly, 1)[0];
  assert.equal(roundName("ประเมินประจำเดือน {เดือน} {ปี}", o), "ประเมินประจำเดือน พฤศจิกายน 2569");
  assert.equal(roundName("รอบ {ปี} ไตรมาส {ไตรมาส} {เหมือนเดิม}", o), "รอบ 2569 ไตรมาส 4 {เหมือนเดิม}", "unknown words stay as typed");
  assert.equal(roundName("  {เดือน}  ", o), "พฤศจิกายน", "trimmed");
  assert.ok(roundName("ก".repeat(300), o).length <= 200);
});
check("a draft is due from 3 days before the round opens until the round closes", () => {
  assert.equal(DRAFT_LEAD_DAYS, 3);
  assert.deepEqual(keys(dueOccurrences("2026-11-27", monthly)), [], "a day too early");
  assert.deepEqual(keys(dueOccurrences("2026-11-28", monthly)), ["2026-11"], "first day of the window");
  assert.deepEqual(keys(dueOccurrences("2026-12-01", monthly)), ["2026-11"], "the opening day");
  assert.deepEqual(keys(dueOccurrences("2026-12-07", monthly)), ["2026-11"], "the closing day");
  assert.deepEqual(keys(dueOccurrences("2026-12-08", monthly)), [], "after it closed nothing is made late");
});
check("a setup made in the middle of a window still gets that round's draft", () => {
  assert.deepEqual(keys(dueOccurrences("2026-12-03", monthly)), ["2026-11"]);
});
check("the draft window can cross a month and a leap day", () => {
  const c = { frequency: "MONTHLY", openDay: 2, closeDay: 9 };
  const mar27 = occurrencesBetween(c, 2027, 2027).find((o) => o.startIso === "2027-03-02");
  assert.equal(mar27.draftFromIso, "2027-02-27");
  const mar28 = occurrencesBetween(c, 2028, 2028).find((o) => o.startIso === "2028-03-02");
  assert.equal(mar28.draftFromIso, "2028-02-28", "2028 has a 29 February");
});
check("a quarterly round opens in January, April, July and October for the quarter that ended", () => {
  const q = { frequency: "QUARTERLY", openDay: 1, closeDay: 10 };
  const up = upcomingOccurrences("2026-11-15", q, 3);
  assert.deepEqual(keys(up), ["2026-Q4", "2027-Q1", "2027-Q2"]);
  assert.deepEqual(up.map((o) => o.startIso), ["2027-01-01", "2027-04-01", "2027-07-01"]);
  assert.equal(up[0].monthText, "ตุลาคม ถึง ธันวาคม");
  assert.equal(up[0].yearText, "2569");
  assert.equal(up[0].quarterText, "4");
  assert.equal(up[1].monthText, "มกราคม ถึง มีนาคม");
});
check("a yearly round opens each January for the year that ended", () => {
  const y = { frequency: "YEARLY", openDay: 5, closeDay: 20 };
  const up = upcomingOccurrences("2026-11-15", y, 2);
  assert.deepEqual(keys(up), ["2026", "2027"]);
  assert.deepEqual(up.map((o) => o.startIso), ["2027-01-05", "2028-01-05"]);
  assert.equal(up[0].monthText, "ทั้งปี");
  assert.equal(roundName("ประเมินประจำปี {ปี}", up[0]), "ประเมินประจำปี 2569");
});
check("a period key never repeats, so one round per period is enough to tell what was already made", () => {
  for (const frequency of ["MONTHLY", "QUARTERLY", "YEARLY"]) {
    const ks = keys(occurrencesBetween({ frequency, openDay: 1, closeDay: 7 }, 2025, 2030));
    assert.equal(new Set(ks).size, ks.length, frequency);
  }
});
check("a round already closed today is not listed as upcoming", () => {
  assert.deepEqual(keys(upcomingOccurrences("2026-12-08", monthly, 1)), ["2026-12"], "the December round (7 Dec) is over, January's is next");
  assert.deepEqual(keys(upcomingOccurrences("2026-12-07", monthly, 1)), ["2026-11"], "still running on its closing day");
});
check("days must be 1 to 28 with the close not before the open, and a name and a preset are required", () => {
  const ok = { ...monthly, name: "ประเมิน {เดือน}", preset: "180" };
  assert.equal(checkRecurrence(ok), null);
  assert.equal(checkRecurrence({ ...ok, openDay: 28, closeDay: 28 }), null);
  assert.match(checkRecurrence({ ...ok, openDay: 29, closeDay: 29 }), /1 ถึง 28/);
  assert.match(checkRecurrence({ ...ok, openDay: 0 }), /1 ถึง 28/);
  assert.match(checkRecurrence({ ...ok, openDay: 1.5 }), /1 ถึง 28/);
  assert.match(checkRecurrence({ ...ok, openDay: 10, closeDay: 9 }), /ไม่ก่อนวันเปิด/);
  assert.match(checkRecurrence({ ...ok, name: "   " }), /ชื่อรอบ/);
  assert.match(checkRecurrence({ ...ok, preset: "45" }), /ผู้ประเมิน/);
  assert.match(checkRecurrence({ ...ok, frequency: "WEEKLY" }), /ความถี่/);
});

console.log(`\n${n} checks passed`);
