// Checks the pure half of น้องวีบอท's request approval (input, wording, card, stop text) with made-up data.
// Run: node --experimental-strip-types scripts/check-ai-approve-proposal.mjs
import assert from "node:assert/strict";
import {
  APPROVE_SKIP_REASON,
  bangkokTime,
  buildApproveCard,
  checkApproveInput,
  correctionEffect,
  insufficientReason,
  leaveWhen,
  MAX_APPROVE,
  remainingEffect,
  stoppedText,
  thaiDay,
} from "../src/features/ai/approve-proposal.ts";
import { thaiDay as shiftThaiDay } from "../src/features/ai/shift-proposal.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const id = (k) => `00000000-0000-4000-8000-${String(k).padStart(12, "0")}`;

check("the copied day formatter matches the shift one for every day of a leap year", () => {
  for (let t = Date.parse("2028-01-01T00:00:00Z"); t < Date.parse("2029-01-01T00:00:00Z"); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    assert.equal(thaiDay(iso), shiftThaiDay(iso), iso);
  }
});
check("a list of leave and correction ids is accepted in order", () => {
  const r = checkApproveInput([{ kind: "leave", id: id(1) }, { kind: "correction", id: id(2) }]);
  assert.deepEqual(r, { ok: true, items: [{ kind: "leave", id: id(1) }, { kind: "correction", id: id(2) }] });
});
check("the same id twice counts once", () => {
  assert.equal(checkApproveInput([{ kind: "leave", id: id(1) }, { kind: "leave", id: id(1) }]).items.length, 1);
});
check("an empty or missing list is refused with a pointer to list_pending_approvals", () => {
  for (const bad of [undefined, null, [], "x"]) {
    const r = checkApproveInput(bad);
    assert.equal(r.ok, false);
    assert.match(r.message, /list_pending_approvals/);
  }
});
check("overtime is refused with the reason it changes pay", () => {
  const r = checkApproveInput([{ kind: "leave", id: id(1) }, { kind: "overtime", id: id(2) }]);
  assert.equal(r.ok, false);
  assert.match(r.message, /ค่าจ้าง/);
  assert.match(r.message, /หน้า OT/);
});
check("an unknown kind or a non-uuid id is refused, never guessed", () => {
  assert.equal(checkApproveInput([{ kind: "expense", id: id(1) }]).ok, false);
  assert.equal(checkApproveInput([{ kind: "leave", id: "123" }]).ok, false);
  assert.equal(checkApproveInput([null]).ok, false);
});
check("more than 20 requests is refused and the model is told to narrow it down", () => {
  const many = Array.from({ length: MAX_APPROVE + 1 }, (_, k) => ({ kind: "leave", id: id(k + 1) }));
  const r = checkApproveInput(many);
  assert.equal(r.ok, false);
  assert.match(r.message, /ไม่เกิน 20/);
  assert.equal(checkApproveInput(many.slice(0, 20)).ok, true);
});
check("remaining leave shows before and after, half days exact", () => {
  assert.equal(remainingEffect(30, 1, "วัน"), "คงเหลือ 30 → 29 วัน");
  assert.equal(remainingEffect(10, 0.5, "วัน"), "คงเหลือ 10 → 9.5 วัน");
  assert.equal(remainingEffect(8, 2, "ชม."), "คงเหลือ 8 → 6 ชม.");
  assert.equal(remainingEffect(0.3, 0.1, "วัน"), "คงเหลือ 0.3 → 0.2 วัน");
});
check("leave dates read as one day, a span, a half day or hours", () => {
  const base = { days: 1, halfDay: false, unit: "DAY" };
  assert.equal(leaveWhen({ ...base, startDate: "2026-11-17", endDate: "2026-11-17" }), "อ 17 พ.ย. (1 วัน)");
  assert.equal(leaveWhen({ ...base, days: 2, startDate: "2026-11-18", endDate: "2026-11-19" }), "พ 18 พ.ย. ถึง พฤ 19 พ.ย. (2 วัน)");
  assert.equal(leaveWhen({ ...base, days: 0.5, halfDay: true, halfDayPeriod: "MORNING", startDate: "2026-11-20", endDate: "2026-11-20" }), "ศ 20 พ.ย. (ครึ่งวันเช้า)");
  assert.equal(leaveWhen({ ...base, halfDay: true, halfDayPeriod: "AFTERNOON", startDate: "2026-11-20", endDate: "2026-11-20" }), "ศ 20 พ.ย. (ครึ่งวันบ่าย)");
  assert.equal(leaveWhen({ days: 0, halfDay: false, unit: "HOUR", hours: 2, startTime: "09:00", endTime: "11:00", startDate: "2026-11-17", endDate: "2026-11-17" }), "อ 17 พ.ย. 09:00-11:00 (2 ชม.)");
});
check("correction times are Bangkok time and say what is missing", () => {
  assert.equal(bangkokTime(new Date("2026-11-17T01:55:00Z")), "08:55");
  assert.equal(bangkokTime(new Date("2026-11-17T18:30:00Z")), "01:30");
  assert.equal(bangkokTime(null), null);
  assert.equal(correctionEffect(new Date("2026-11-17T01:55:00Z"), new Date("2026-11-17T11:02:00Z")), "บันทึกเข้า 08:55 ออก 18:02");
  assert.equal(correctionEffect(new Date("2026-11-17T01:55:00Z"), null), "บันทึกเข้า 08:55");
  assert.equal(correctionEffect(null, null), "ไม่เปลี่ยนเวลา");
});
check("the reasons name the pay rule for overtime-like leave and the numbers for a short balance", () => {
  assert.match(APPROVE_SKIP_REASON.notQuotaLeave, /HR ยืนยัน/);
  assert.equal(insufficientReason(1, 3, "วัน"), "วันลาคงเหลือไม่พอ (เหลือ 1 วัน ขอ 3 วัน)");
  assert.equal(insufficientReason(1, 2, "ชม."), "ชั่วโมงลาคงเหลือไม่พอ (เหลือ 1 ชม. ขอ 2 ชม.)");
});
const rows = [
  { ref: { kind: "leave", id: id(1) }, typeLabel: "ลาป่วย", person: "สมชาย (ตัวอย่าง)", when: "อ 17 พ.ย. (1 วัน)", effect: "คงเหลือ 30 → 29 วัน" },
  { ref: { kind: "correction", id: id(2) }, typeLabel: "ขอแก้เวลา", person: "ปิติ (ตัวอย่าง)", when: "จ 16 พ.ย.", effect: "บันทึกเข้า 08:55 ออก 18:02" },
];
check("the card counts the rows, lists the skipped ones with reasons and warns about the effects", () => {
  const c = buildApproveCard("tok", rows, ["ลาไม่รับค่าจ้างของ ข.: ต้องให้ HR ยืนยัน"]);
  assert.equal(c.kind, "approve_requests");
  assert.equal(c.title, "อนุมัติ 2 รายการ");
  assert.equal(c.confirmLabel, "ยืนยัน อนุมัติ 2 รายการ");
  assert.equal(c.table.rows.length, 2);
  assert.deepEqual(c.table.rows[0], ["ลาป่วย", "สมชาย (ตัวอย่าง)", "อ 17 พ.ย. (1 วัน)", "คงเหลือ 30 → 29 วัน"]);
  assert.equal(c.skipped.title, "ข้ามไว้ 1 รายการ (ไม่อยู่ในการ์ด)");
  assert.match(c.note, /หักวันลา/);
  assert.equal(c.preview, null);
});
check("with nothing skipped the card has no skipped block", () => {
  assert.equal(buildApproveCard("tok", rows, []).skipped, undefined);
});
check("the stop text says how many were done, where it stopped and that the done ones stay approved", () => {
  const t = stoppedText(2, 4, 3, "ลาพักร้อนของมานะ", "คำขอนี้ถูกดำเนินการโดยผู้อื่น");
  assert.match(t, /อนุมัติแล้ว 2 จาก 4 รายการ แล้วหยุดที่รายการที่ 3/);
  assert.match(t, /2 รายการแรกอนุมัติเรียบร้อยและยังคงอนุมัติ/);
  assert.match(t, /อีก 1 รายการ/);
  assert.match(stoppedText(0, 3, 1, "x", "y"), /ยังไม่มีรายการไหนถูกอนุมัติ/);
  assert.doesNotMatch(stoppedText(2, 3, 3, "x", "y"), /อีก \d+ รายการหลังจากนั้น/);
});

console.log(`\n${n} checks passed`);
