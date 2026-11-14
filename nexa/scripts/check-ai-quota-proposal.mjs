// Checks the pure half of น้องวีบอท's leave quota change (input, row problems, card) with made-up people and numbers.
// Run: node --experimental-strip-types scripts/check-ai-quota-proposal.mjs
import assert from "node:assert/strict";
import { buildQuotaCard, checkQuotaInput, MAX_QUOTA_ROWS, quotaRowProblem, quotaTypeLabel } from "../src/features/ai/quota-proposal.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const ch = (employee, type, totalDays) => ({ employee, type, totalDays });

check("the year defaults to this year and a list of changes is accepted", () => {
  const r = checkQuotaInput({ changes: [ch("สมชาย", "ANNUAL", 12)] }, 2026);
  assert.deepEqual(r, { ok: true, year: 2026, changes: [{ employee: "สมชาย", type: "ANNUAL", totalDays: 12 }] });
  assert.equal(checkQuotaInput({ year: 2027, changes: [ch("ก", "SICK", 30)] }, 2026).year, 2027);
});
check("a bad year is refused", () => {
  for (const year of [1999, 2101, 2026.5, "2026"]) assert.equal(checkQuotaInput({ year, changes: [ch("ก", "SICK", 1)] }, 2026).ok, false, String(year));
});
check("no changes, or a change without a person, is refused with what to ask", () => {
  assert.equal(checkQuotaInput({}, 2026).ok, false);
  assert.equal(checkQuotaInput({ changes: [] }, 2026).ok, false);
  const r = checkQuotaInput({ changes: [ch("  ", "SICK", 1)] }, 2026);
  assert.equal(r.ok, false);
  assert.match(r.message, /ไม่ระบุพนักงาน/);
});
check("only the three paid types are allowed; unpaid leave has no quota", () => {
  assert.equal(checkQuotaInput({ changes: [ch("ก", "UNPAID", 5)] }, 2026).ok, false);
  assert.equal(checkQuotaInput({ changes: [ch("ก", "OTHER", 5)] }, 2026).ok, false);
  assert.match(checkQuotaInput({ changes: [ch("ก", "UNPAID", 5)] }, 2026).message, /ไม่รับค่าจ้างไม่มีโควตา/);
});
check("days must be 0 to 365 with at most one decimal; half days are fine", () => {
  for (const d of [-1, 366, 1.25, NaN, "5", null]) assert.equal(checkQuotaInput({ changes: [ch("ก", "SICK", d)] }, 2026).ok, false, String(d));
  for (const d of [0, 0.5, 6, 365, 10.5]) assert.equal(checkQuotaInput({ changes: [ch("ก", "SICK", d)] }, 2026).ok, true, String(d));
});
check("the same person and type twice keeps the last value; different types stay separate", () => {
  const r = checkQuotaInput({ changes: [ch("สมชาย", "ANNUAL", 5), ch("สมชาย", "ANNUAL", 8), ch("สมชาย", "SICK", 30), ch("สมหญิง", "ANNUAL", 8)] }, 2026);
  assert.equal(r.changes.length, 3);
  assert.equal(r.changes.find((c) => c.employee === "สมชาย" && c.type === "ANNUAL").totalDays, 8);
});
check("more than 100 entries is refused", () => {
  const many = Array.from({ length: MAX_QUOTA_ROWS + 1 }, (_, i) => ch(`คน${i}`, "ANNUAL", 6));
  assert.equal(checkQuotaInput({ changes: many }, 2026).ok, false);
  assert.equal(checkQuotaInput({ changes: many.slice(0, MAX_QUOTA_ROWS) }, 2026).ok, true);
});
check("a total below the days already used is refused with the lowest allowed value", () => {
  const p = quotaRowProblem({ before: 3, after: 1, used: 2 });
  assert.match(p, /ใช้ไปแล้ว 2 วัน/);
  assert.match(p, /ตั้งแต่ 2 วันขึ้นไป/);
  assert.equal(quotaRowProblem({ before: 3, after: 2, used: 2 }), null);
});
check("the same total as now is a no-op and says so", () => {
  assert.match(quotaRowProblem({ before: 10, after: 10, used: 0 }), /เท่าเดิม/);
  assert.match(quotaRowProblem({ before: 10, after: 10.0, used: 3 }), /เท่าเดิม/);
});
check("type names are in Thai", () => {
  assert.equal(quotaTypeLabel("ANNUAL"), "ลาพักร้อน");
  assert.equal(quotaTypeLabel("SICK"), "ลาป่วย");
  assert.equal(quotaTypeLabel("PERSONAL"), "ลากิจ");
});
const rows = [
  { employeeId: "a", name: "สมชาย (ตัวอย่าง)", type: "ANNUAL", before: 10, after: 12, used: 3 },
];
check("a one-row card shows the year in Buddhist Era, before to after, used and what is left", () => {
  const c = buildQuotaCard("tok", 2026, rows, []);
  assert.equal(c.kind, "adjust_leave_quota");
  assert.equal(c.title, "ปรับโควตา 1 รายการ");
  assert.ok(c.rows.some((r) => r.label === "ปี" && r.value === "2569"));
  assert.deepEqual(c.table.rows[0], ["สมชาย (ตัวอย่าง)", "ลาพักร้อน", "10 → 12 วัน", "3 วัน", "9 วัน"]);
  assert.equal(c.confirmLabel, "ยืนยัน ปรับโควตา 1 รายการ");
  assert.match(c.note, /ย้อนต้องปรับกลับ/);
  assert.equal(c.skipped, undefined);
  assert.equal(c.preview, null);
});
check("lowered quotas are named in the note, and the same target for everyone reads as one action", () => {
  const many = [
    { employeeId: "a", name: "มานี", type: "ANNUAL", before: 0, after: 6, used: 0 },
    { employeeId: "b", name: "วีระ", type: "ANNUAL", before: 10, after: 6, used: 4 },
  ];
  const c = buildQuotaCard("tok", 2026, many, ["สมหญิง ลากิจ: ใช้ไปแล้ว 2 วัน"]);
  assert.ok(c.rows.some((r) => r.label === "การกระทำ" && r.value === "ตั้งลาพักร้อนเป็น 6 วัน เหมือนกันทั้ง 2 รายการ"));
  assert.match(c.note, /1 รายการโควตาลดลง \(วีระ\)/);
  assert.equal(c.skipped.title, "ข้ามไว้ 1 รายการ (ไม่อยู่ในการ์ด)");
});
check("mixed targets read as the general action", () => {
  const mixed = [
    { employeeId: "a", name: "ก", type: "ANNUAL", before: 0, after: 6, used: 0 },
    { employeeId: "b", name: "ข", type: "SICK", before: 30, after: 20, used: 0 },
  ];
  assert.match(buildQuotaCard("tok", 2026, mixed, []).rows[0].value, /ไม่แตะวันที่ใช้ไปแล้ว/);
});

console.log(`\n${n} checks passed`);
