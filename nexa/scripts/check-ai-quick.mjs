// Checks the short commands of the quick actions and how an answer is written out.
// Run: node --experimental-strip-types scripts/check-ai-quick.mjs
import assert from "node:assert/strict";
import { LOCAL_SOURCE_LINE, QUICK_ACTIONS, QUICK_MAX_ROWS, parseQuickCommand, quickToMarkdown, rowsNote } from "../src/features/ai/quick-actions.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("each button's own words are understood when typed", () => {
  for (const a of QUICK_ACTIONS) {
    if (a.needs === "name") continue;
    assert.equal(parseQuickCommand(a.label)?.action, a.id, a.label);
  }
});
check("leave quota takes the name after it, with or without 'ของ'", () => {
  assert.deepEqual(parseQuickCommand("โควตาวันลาของ สมชาย ใจดี"), { action: "leave_quota", name: "สมชาย ใจดี" });
  assert.deepEqual(parseQuickCommand("โควตา 1023"), { action: "leave_quota", name: "1023" });
  assert.deepEqual(parseQuickCommand("วันลาคงเหลือ  สมหญิง"), { action: "leave_quota", name: "สมหญิง" });
  assert.deepEqual(parseQuickCommand("โควตาวันลา"), { action: "leave_quota" }, "no name yet, the screen asks for one");
});
check("announcement and notification open their forms", () => {
  assert.equal(parseQuickCommand("ส่งประกาศ")?.action, "announce");
  assert.equal(parseQuickCommand("ประกาศ หยุดวันที่ 5")?.action, "announce");
  assert.equal(parseQuickCommand("ส่งแจ้งเตือน")?.action, "notify");
  assert.equal(parseQuickCommand("ส่งแจ้งเตือนทุกคน")?.action, "notify");
});
check("common ways of asking map to the same action", () => {
  assert.equal(parseQuickCommand("วันนี้ใครมาสายบ้าง")?.action, "late_today");
  assert.equal(parseQuickCommand("ใครขาดงานวันนี้")?.action, "absent_today");
  assert.equal(parseQuickCommand("มีคำขอรออนุมัติไหม")?.action, "pending_approvals");
  assert.equal(parseQuickCommand("ดูตารางกะ")?.action, "shifts_week");
  assert.equal(parseQuickCommand("รอบประเมินถึงไหนแล้ว")?.action, "eval_progress");
});
check("typed text after the word is kept as the title of the form", () => {
  assert.deepEqual(parseQuickCommand("ประกาศ หยุดวันที่ 5 ธ.ค."), { action: "announce", title: "หยุดวันที่ 5 ธ.ค." });
  assert.deepEqual(parseQuickCommand("ส่งแจ้งเตือน ปิดระบบคืนนี้"), { action: "notify", title: "ปิดระบบคืนนี้" });
  assert.deepEqual(parseQuickCommand("ส่งประกาศ"), { action: "announce" });
});
check("a sentence that only contains a keyword is not a command", () => {
  for (const t of ["ใบลาของสมชายที่รออนุมัติ", "ใครไม่เคยมาสาย", "ประกาศนียบัตรของสมชาย", "ตารางกะของแผนกขาย", "ใครขาดงานบ่อยสุดเดือนนี้", "สรุปผลประเมินของสมหญิง"]) {
    assert.equal(parseQuickCommand(t), null, t);
  }
});
check("anything not understood returns null, never a guess", () => {
  for (const t of ["", "   ", "สวัสดี", "สรุป OT เดือนนี้ พร้อมค่าใช้จ่าย", "ปีนี้ใครลาเยอะสุด 5 อันดับ", "ก".repeat(200)]) {
    assert.equal(parseQuickCommand(t), null, t.slice(0, 20));
  }
});
check("an answer is Markdown with the table and always the local-source line", () => {
  const md = quickToMarkdown({ text: "มาสาย 2 คน", table: { head: ["ชื่อ", "สาย (นาที)"], rows: [["สมชาย", "12"], ["สม|หญิง", "5"]] }, note: "แสดง 2 จาก 9 คน" });
  const lines = md.split("\n").filter(Boolean);
  assert.equal(lines[0], "มาสาย 2 คน");
  assert.equal(lines[1], "| ชื่อ | สาย (นาที) |");
  assert.equal(lines[2], "| --- | --- |");
  assert.equal(lines[4], "| สม/หญิง | 5 |", "a pipe inside a cell cannot break the table");
  assert.equal(lines[5], "แสดง 2 จาก 9 คน");
  assert.equal(lines.at(-1), `*${LOCAL_SOURCE_LINE}*`);
  assert.match(LOCAL_SOURCE_LINE, /ไม่ใช้ AI/);
});
check("no rows means no table, only the text and the source line", () => {
  const md = quickToMarkdown({ text: "ไม่มี", table: { head: ["ชื่อ"], rows: [] } });
  assert.doesNotMatch(md, /\|/);
  assert.match(md, /ไม่ใช้ AI/);
});
check("the note appears only when rows were cut", () => {
  assert.equal(rowsNote(20, 20, "คน"), undefined);
  assert.equal(rowsNote(QUICK_MAX_ROWS, 34, "คน"), "แสดง 20 จาก 34 คน");
});

console.log(`\n${n} checks passed`);
