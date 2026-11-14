// Checks the pure half of น้องวีบอท's shift assignment (dates, rows, card) with made-up people and dates.
// Run: node --experimental-strip-types scripts/check-ai-shift-proposal.mjs
import assert from "node:assert/strict";
import {
  buildShiftCard,
  checkSize,
  countKinds,
  expandDates,
  MAX_SHIFT_ROWS,
  planRows,
  rangeText,
  thaiDay,
} from "../src/features/ai/shift-proposal.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a from-to range expands to every day in it", () => {
  const r = expandDates({ from: "2026-11-17", to: "2026-11-21" });
  assert.deepEqual(r, { ok: true, dates: ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"] });
});
check("weekdays limit a range (1-5 skips Saturday and Sunday)", () => {
  const r = expandDates({ from: "2026-11-14", to: "2026-11-23", weekdays: [1, 2, 3, 4, 5] });
  assert.deepEqual(r.dates, ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-23"]);
});
check("an explicit list is sorted and de-duplicated", () => {
  assert.deepEqual(expandDates({ dates: ["2026-11-20", "2026-11-18", "2026-11-20"] }).dates, ["2026-11-18", "2026-11-20"]);
});
check("a single `from` is one day", () => {
  assert.deepEqual(expandDates({ from: "2026-11-22" }).dates, ["2026-11-22"]);
});
check("bad input is refused with Thai text and never guessed", () => {
  for (const bad of [{}, { from: "2026-02-30" }, { from: "2026-11-20", to: "2026-11-10" }, { dates: ["x"] }, { from: "2026-11-01", to: "2026-11-05", weekdays: [9] }, { from: "2026-11-01", to: "2026-11-05", weekdays: "1" }]) {
    const r = expandDates(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(r.message.length > 5);
  }
});
check("a weekday filter that leaves nothing is refused", () => {
  assert.equal(expandDates({ from: "2026-11-14", to: "2026-11-15", weekdays: [1] }).ok, false);
});
check("a span over 62 days is refused", () => {
  assert.equal(expandDates({ from: "2026-01-01", to: "2026-12-31" }).ok, false);
  assert.equal(expandDates({ from: "2026-01-01", to: "2026-03-03" }).ok, true);
});
check("the 100-row limit counts people x days and says how to split", () => {
  assert.equal(checkSize(3, 5), null);
  assert.equal(checkSize(20, 5), null);
  assert.match(checkSize(21, 5), /105 รายการ/);
  assert.equal(MAX_SHIFT_ROWS, 100);
  assert.match(checkSize(0, 5), /ยังไม่ระบุพนักงาน/);
  assert.match(checkSize(41, 1), /ไม่เกิน 40 คน/);
});
check("Thai day text uses the right weekday", () => {
  assert.equal(thaiDay("2026-11-17"), "อ 17 พ.ย.");
  assert.equal(thaiDay("2026-11-16"), "จ 16 พ.ย.");
  assert.equal(rangeText(["2026-11-17", "2026-11-21"]), "อ 17 พ.ย. 2569 ถึง ส 21 พ.ย. 2569 (2 วัน)");
});

const people = [
  { id: "a", name: "สมชาย (ตัวอย่าง)" },
  { id: "b", name: "สมหญิง (ตัวอย่าง)" },
];
const dates = ["2026-11-17", "2026-11-18", "2026-11-19"];
const existing = new Map([
  ["a|2026-11-18", { templateId: "afternoon", name: "กะบ่าย" }],
  ["b|2026-11-19", { templateId: "morning", name: "กะเช้า" }],
]);
check("rows are new, replace (another shift) or same (already this shift)", () => {
  const rows = planRows(people, dates, "morning", existing);
  assert.equal(rows.length, 6);
  assert.equal(rows.find((r) => r.employeeId === "a" && r.date === "2026-11-18").kind, "replace");
  assert.equal(rows.find((r) => r.employeeId === "b" && r.date === "2026-11-19").kind, "same");
  assert.deepEqual(countKinds(rows), { created: 4, replaced: 1, unchanged: 1, changing: 5 });
});
const tpl = { name: "กะเช้า", startTime: "08:00", endTime: "17:00", breakMinutes: 60 };
check("the card counts only real changes and warns about replaced shifts", () => {
  const c = buildShiftCard("tok", tpl, planRows(people, dates, "morning", existing));
  assert.equal(c.kind, "assign_shifts");
  assert.equal(c.confirmLabel, "ยืนยัน ตั้งกะ 5 รายการ");
  assert.equal(c.doneText, "ตั้งกะแล้ว 5 รายการ");
  assert.match(c.note, /1 รายการจะแทนกะเดิม/);
  assert.ok(c.rows.some((r) => r.label === "ผลต่อกะเดิม" && r.value.includes("แทนกะเดิม 1") && r.value.includes("มีกะนี้อยู่แล้ว 1")));
  assert.ok(c.rows.some((r) => r.label === "กะ" && r.value === "กะเช้า 08:00-17:00 (พัก 60 นาที)"));
  assert.equal(c.preview, null);
  assert.equal(c.detail.rows.length, 6);
  assert.ok(c.detail.rows.some((r) => r[2] === "กะบ่าย → กะเช้า"));
  assert.ok(c.detail.rows.some((r) => r[2] === "ไม่มี → กะเช้า"));
  assert.ok(c.detail.rows.some((r) => r[2] === "กะเช้า (ไม่เปลี่ยน)"));
});
check("a clean one-person one-day card has no table, no fold and no warning", () => {
  const c = buildShiftCard("tok", { ...tpl, breakMinutes: 0 }, planRows([people[0]], ["2026-11-22"], "morning", new Map()));
  assert.equal(c.table, undefined);
  assert.equal(c.detail, undefined);
  assert.equal(c.note, undefined);
  assert.equal(c.title, "ตั้งกะเช้า 1 รายการ");
  assert.ok(c.rows.some((r) => r.value === "กะเช้า 08:00-17:00"));
});

console.log(`\n${n} checks passed`);
