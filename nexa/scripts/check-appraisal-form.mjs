// Checks the pure rules of appraisal forms with made-up questions only.
// Run: node --experimental-strip-types scripts/check-appraisal-form.mjs
import assert from "node:assert/strict";
import { formProblems, isEditable, nextVersion, ratingWeightTotal } from "../src/features/appraisal-form/rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const rating = (text = "คำถาม", weight = 1) => ({ text, answerType: "RATING", weight });
const choice = (options, type = "CHOICE") => ({ text: "เลือก", answerType: type, options, weight: 0 });

check("a form with no questions cannot be published", () => {
  assert.deepEqual(formProblems([]), ["ยังไม่มีคำถาม"]);
});
check("a complete form has no problems", () => {
  assert.deepEqual(
    formProblems([rating(), choice([{ value: "a", label: "ดี" }, { value: "b", label: "พอใช้" }]), { text: "ความเห็น", answerType: "PARAGRAPH", weight: 0 }]),
    [],
  );
});
check("an empty question text is reported with its number", () => {
  assert.deepEqual(formProblems([rating("ข้อแรก"), rating("  ")]), ["ข้อ 2 ยังไม่ได้พิมพ์คำถาม"]);
});
check("a choice question needs at least 2 options", () => {
  assert.deepEqual(formProblems([choice([{ value: "a", label: "ดี" }])]), ["ข้อ 1 ต้องมีตัวเลือกอย่างน้อย 2 ข้อ"]);
  assert.deepEqual(formProblems([choice(null, "MULTI_CHOICE")]), ["ข้อ 1 ต้องมีตัวเลือกอย่างน้อย 2 ข้อ"]);
});
check("blank or duplicate option labels are reported", () => {
  assert.deepEqual(formProblems([choice([{ value: "a", label: "ดี" }, { value: "b", label: " " }])]), ["ข้อ 1 มีตัวเลือกที่ยังว่าง"]);
  assert.deepEqual(formProblems([choice([{ value: "a", label: "ดี" }, { value: "b", label: "ดี" }])]), ["ข้อ 1 มีตัวเลือกซ้ำกัน"]);
});
check("a rating question needs a weight of at least 1", () => {
  assert.deepEqual(formProblems([rating("ข้อ", 0)]), ["ข้อ 1 ต้องมีน้ำหนักอย่างน้อย 1"]);
});
check("text questions never need options or weight", () => {
  assert.deepEqual(formProblems([{ text: "สั้น", answerType: "SHORT_TEXT", weight: 0 }]), []);
});
check("only RATING questions add to the weight total", () => {
  assert.equal(ratingWeightTotal([rating("a", 2), rating("b", 3), { text: "x", answerType: "PARAGRAPH", weight: 9 }]), 5);
});
check("only a draft can be edited", () => {
  assert.equal(isEditable("DRAFT"), true);
  assert.equal(isEditable("PUBLISHED"), false);
  assert.equal(isEditable("ARCHIVED"), false);
});
check("next version follows the highest existing one", () => {
  assert.equal(nextVersion([]), 1);
  assert.equal(nextVersion([1, 2]), 3);
  assert.equal(nextVersion([3, 1]), 4);
});

console.log(`\n${n} checks passed`);
