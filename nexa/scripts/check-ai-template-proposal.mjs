// Checks the pure half of น้องวีบอท's draft evaluation form (cleaning, weights, card) with made-up questions.
// Run: node --experimental-strip-types scripts/check-ai-template-proposal.mjs
import assert from "node:assert/strict";
import { answerLabel, buildTemplateCard, isScoring, normalizeDraft, spreadWeights, summarizeDraft } from "../src/features/ai/template-proposal.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

// Stand-in for the system's default answer scales.
const defaults = (t) =>
  ({
    NUMERIC: [1, 2, 3, 4, 5].map((s) => ({ value: String(s), label: `ระดับ ${s}`, score: s })),
    YES_NO: [{ value: "YES", label: "ใช่", score: 1 }, { value: "NO", label: "ไม่ใช่", score: 0 }],
    LETTER: ["A", "B", "C", "D"].map((l, i) => ({ value: l, label: l, score: 4 - i })),
  })[t];
const q = (text, extra = {}) => ({ text, answerType: "NUMERIC", ...extra });
const draft = (sections, extra = {}) => ({ name: "แบบประเมินตัวอย่าง", sections, ...extra });

check("spreadWeights always adds up to exactly 100, whole numbers, at least 1", () => {
  for (let k = 1; k <= 40; k++) {
    const w = spreadWeights(k);
    assert.equal(w.length, k);
    assert.equal(w.reduce((a, b) => a + b, 0), 100, `n=${k}`);
    assert.ok(w.every((x) => Number.isInteger(x) && x >= 1));
  }
  assert.deepEqual(spreadWeights(3), [34, 33, 33]);
  assert.deepEqual(spreadWeights(0), []);
});
check("with no weights given the system splits evenly and says so", () => {
  const r = normalizeDraft(draft([{ name: "หมวด ก", questions: [q("ข้อ 1"), q("ข้อ 2"), q("ข้อ 3")] }]), defaults);
  assert.equal(r.ok, true);
  assert.equal(r.autoWeights, true);
  assert.deepEqual(r.draft.sections[0].questions.map((x) => x.weight), [34, 33, 33]);
});
check("weights that add up to 100 are kept as given", () => {
  const r = normalizeDraft(draft([{ name: "ก", questions: [q("1", { weight: 60 }), q("2", { weight: 40 })] }]), defaults);
  assert.equal(r.ok, true);
  assert.equal(r.autoWeights, false);
  assert.deepEqual(r.draft.sections[0].questions.map((x) => x.weight), [60, 40]);
});
check("weights that do not add up to 100 are refused with the sum, never silently rescaled", () => {
  const r = normalizeDraft(draft([{ name: "ก", questions: [q("1", { weight: 60 }), q("2", { weight: 30 })] }]), defaults);
  assert.equal(r.ok, false);
  assert.match(r.message, /90%/);
});
check("some weights given and some missing is refused", () => {
  const r = normalizeDraft(draft([{ name: "ก", questions: [q("1", { weight: 100 }), q("2")] }]), defaults);
  assert.equal(r.ok, false);
  assert.match(r.message, /ไม่ครบ/);
});
check("non-whole or out-of-range weights are refused", () => {
  for (const w of [33.5, 0, 101, -5]) {
    assert.equal(normalizeDraft(draft([{ name: "ก", questions: [q("1", { weight: w }), q("2", { weight: 100 - 1 })] }]), defaults).ok, false, String(w));
  }
});
check("free-text questions are not scored and do not need a weight", () => {
  const r = normalizeDraft(
    draft([{ name: "ก", questions: [q("คะแนน 1"), q("คะแนน 2"), q("ข้อเสนอแนะ", { answerType: "LONG_TEXT" })] }]),
    defaults,
  );
  assert.equal(r.ok, true);
  const qs = r.draft.sections[0].questions;
  assert.deepEqual(qs.slice(0, 2).map((x) => x.weight), [50, 50]);
  assert.equal(qs[2].options, undefined);
  assert.equal(isScoring("LONG_TEXT"), false);
  assert.equal(isScoring("NUMERIC"), true);
});
check("a form with only free-text questions is refused", () => {
  assert.equal(normalizeDraft(draft([{ name: "ก", questions: [q("เล่าหน่อย", { answerType: "LONG_TEXT" })] }]), defaults).ok, false);
});
check("answer scales default to the system's, and a choice question needs its own options", () => {
  const r = normalizeDraft(draft([{ name: "ก", questions: [q("a"), q("b", { answerType: "YES_NO" }), q("c", { answerType: "LETTER" })] }]), defaults);
  assert.equal(r.draft.sections[0].questions[0].options.length, 5);
  assert.equal(r.draft.sections[0].questions[1].options.length, 2);
  assert.equal(r.draft.sections[0].questions[2].options[0].label, "A");
  const bad = normalizeDraft(draft([{ name: "ก", questions: [q("เลือก", { answerType: "CHOICE" })] }]), defaults);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /ตัวเลือก/);
  const good = normalizeDraft(draft([{ name: "ก", questions: [q("เลือก", { answerType: "CHOICE", options: [{ label: "ดี", score: 3 }, { label: "พอใช้", score: 1 }] })] }]), defaults);
  assert.equal(good.ok, true);
  assert.deepEqual(good.draft.sections[0].questions[0].options.map((o) => o.value), ["o1", "o2"]);
});
check("bad options are refused: too few, a score out of range, no label", () => {
  const one = (opts) => normalizeDraft(draft([{ name: "ก", questions: [q("x", { answerType: "CHOICE", options: opts })] }]), defaults);
  assert.equal(one([{ label: "a", score: 1 }]).ok, false);
  assert.equal(one([{ label: "a", score: 1 }, { label: "b", score: 101 }]).ok, false);
  assert.equal(one([{ label: "a", score: 1 }, { score: 2 }]).ok, false);
  assert.equal(one([{ label: "a", score: 1 }, { label: "b", score: "2" }]).ok, false);
});
check("size limits: 6 sections, 8 per section, 40 in total", () => {
  const sec = (name, k) => ({ name, questions: Array.from({ length: k }, (_, i) => q(`${name} ข้อ ${i + 1}`)) });
  assert.equal(normalizeDraft(draft(Array.from({ length: 7 }, (_, i) => sec(`ก${i}`, 1))), defaults).ok, false);
  assert.equal(normalizeDraft(draft([sec("ก", 9)]), defaults).ok, false);
  assert.equal(normalizeDraft(draft([sec("ก", 8), sec("ข", 8), sec("ค", 8), sec("ง", 8), sec("จ", 8), sec("ฉ", 8)]), defaults).ok, false);
  assert.equal(normalizeDraft(draft([sec("ก", 8), sec("ข", 8), sec("ค", 8), sec("ง", 8), sec("จ", 8)]), defaults).ok, true);
});
check("missing names, empty sections, bad types and duplicate questions are refused", () => {
  assert.equal(normalizeDraft({ sections: [{ name: "ก", questions: [q("x")] }] }, defaults).ok, false);
  assert.equal(normalizeDraft(draft([]), defaults).ok, false);
  assert.equal(normalizeDraft(draft([{ name: "", questions: [q("x")] }]), defaults).ok, false);
  assert.equal(normalizeDraft(draft([{ name: "ก", questions: [] }]), defaults).ok, false);
  assert.equal(normalizeDraft(draft([{ name: "ก", questions: [q("x", { answerType: "FILE_EVIDENCE" })] }]), defaults).ok, false);
  const dup = normalizeDraft(draft([{ name: "ก", questions: [q("ซ้ำ"), q("ซ้ำ")] }, { name: "ข", questions: [q("ซ้ำ")] }]), defaults);
  assert.equal(dup.ok, false);
  assert.match(dup.message, /ซ้ำ/);
});
check("the same question text with a different answer type is allowed", () => {
  assert.equal(normalizeDraft(draft([{ name: "ก", questions: [q("เป็นอย่างไร"), q("เป็นอย่างไร", { answerType: "LONG_TEXT" })] }]), defaults).ok, true);
});
check("answers read in words", () => {
  const d = normalizeDraft(draft([{ name: "ก", questions: [q("a"), q("b", { answerType: "YES_NO" }), q("c", { answerType: "LETTER" }), q("d", { answerType: "LONG_TEXT" }), q("e", { answerType: "SHORT_TEXT" })] }]), defaults).draft.sections[0].questions;
  assert.deepEqual(d.map(answerLabel), ["ระดับ 1-5", "ใช่/ไม่ใช่", "ตัวอักษร A-D", "ข้อความอิสระ", "ข้อความสั้น"]);
  assert.equal(answerLabel({ answerType: "CHOICE", options: [{}, {}, {}] }), "เลือก 3 ตัวเลือก");
});
const full = normalizeDraft(
  draft(
    [
      { name: "การทำงาน", questions: [q("แม่นยำ", { weight: 30 }), q("ตรงเวลา", { weight: 30 })] },
      { name: "ทีม", questions: [q("ช่วยเพื่อน", { weight: 20 }), q("ปลอดภัย", { answerType: "YES_NO", weight: 20 }), q("เสนอแนะ", { answerType: "LONG_TEXT" })] },
    ],
    { evaluationType: "ประจำปี" },
  ),
  defaults,
);
check("the card counts sections, questions and the weight total, and says it is only a draft", () => {
  assert.equal(full.ok, true);
  assert.deepEqual(summarizeDraft(full.draft), { sections: 2, questions: 5, scoring: 4, freeText: 1, weightTotal: 100 });
  const c = buildTemplateCard("tok", full.draft, false);
  assert.equal(c.kind, "draft_evaluation_template");
  assert.ok(c.rows.some((r) => r.label === "ขนาด" && r.value === "2 หมวด 5 ข้อ (ให้คะแนน 4 ข้อ, ข้อความอิสระ 1 ข้อ)"));
  assert.ok(c.rows.some((r) => r.label === "น้ำหนักรวม" && r.value === "100%"));
  assert.ok(c.rows.some((r) => r.label === "ประเภท" && r.value === "ประจำปี"));
  assert.ok(c.rows.some((r) => r.value.startsWith("ฉบับร่าง")));
  assert.match(c.note, /HR ตรวจ/);
  assert.equal(c.confirmLabel, "ยืนยัน บันทึกเป็นฉบับร่าง");
  assert.equal(c.doneText, "บันทึกแบบประเมินฉบับร่างแล้ว 2 หมวด 5 ข้อ");
  assert.deepEqual(c.table.rows, [["การทำงาน", "2", "60%"], ["ทีม", "3", "40%"]]);
  assert.equal(c.detail.label, "ดูครบทั้ง 5 ข้อ");
  assert.deepEqual(c.detail.rows[3], ["ทีม", "ปลอดภัย", "ใช่/ไม่ใช่", "20%"]);
  assert.deepEqual(c.detail.rows[4], ["ทีม", "เสนอแนะ", "ข้อความอิสระ", "ไม่นับคะแนน"]);
});
check("when the system split the weights the card says they can be adjusted", () => {
  const c = buildTemplateCard("tok", full.draft, true);
  assert.ok(c.rows.some((r) => r.label === "น้ำหนักรวม" && r.value.includes("ระบบแบ่งเท่าๆ กัน")));
});
check("a form with only scored questions has no free-text part in the size line and no type row without a type", () => {
  const r = normalizeDraft(draft([{ name: "ก", questions: [q("1"), q("2")] }]), defaults);
  const c = buildTemplateCard("tok", r.draft, true);
  assert.ok(c.rows.some((x) => x.label === "ขนาด" && x.value === "1 หมวด 2 ข้อ"));
  assert.ok(!c.rows.some((x) => x.label === "ประเภท"));
});

console.log(`\n${n} checks passed`);
