// Checks what the free backup AI is sent and how its answer is shown.
// Run: node --experimental-strip-types scripts/check-backup-ai.mjs
import assert from "node:assert/strict";
import { BACKUP_MAX_QUESTION, BACKUP_NOTE, BACKUP_SYSTEM_PROMPT, backupQuestion, backupReply } from "../src/features/ai/backup-ai.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("only the newest typed question is sent, never earlier turns (they may hold employee data from the main AI)", () => {
  const q = backupQuestion({
    hasAttachments: false,
    messages: [
      { role: "user", content: "ใครมาสายวันนี้" },
      { role: "assistant", content: "สมชาย ใจดี สาย 12 นาที" },
      { role: "user", content: "ขั้นตอนขอลาป่วยทำยังไง" },
    ],
  });
  assert.equal(q, "ขั้นตอนขอลาป่วยทำยังไง");
  assert.ok(!String(q).includes("สมชาย"));
});

check("attached files stop the backup from being used", () => {
  assert.equal(backupQuestion({ hasAttachments: true, messages: [{ role: "user", content: "ช่วยดูไฟล์" }] }), null);
});

check("no typed question means nothing is sent", () => {
  assert.equal(backupQuestion({ hasAttachments: false, messages: [] }), null);
  assert.equal(backupQuestion({ hasAttachments: false, messages: [{ role: "assistant", content: "สวัสดี" }] }), null);
  assert.equal(backupQuestion({ hasAttachments: false, messages: [{ role: "user", content: "   " }] }), null);
});

check("a very long question is cut to the limit", () => {
  const q = backupQuestion({ hasAttachments: false, messages: [{ role: "user", content: "ก".repeat(BACKUP_MAX_QUESTION + 500) }] });
  assert.equal(q.length, BACKUP_MAX_QUESTION);
});

check("every backup answer says who answered, and an empty answer is not shown", () => {
  assert.equal(backupReply("ยื่นใบลาที่เมนูลางาน"), `ยื่นใบลาที่เมนูลางาน\n\n${BACKUP_NOTE}`);
  assert.equal(backupReply("  "), null);
  assert.equal(backupReply(null), null);
  assert.equal(backupReply(undefined), null);
});

check("the instructions say the backup sees no company data and cannot act, and point data questions at the quick buttons", () => {
  assert.ok(BACKUP_SYSTEM_PROMPT.includes("มองไม่เห็นข้อมูลบริษัท"));
  assert.ok(BACKUP_SYSTEM_PROMPT.includes("ปุ่มลัด"));
});

check("the instructions forbid inventing menu or button names, because the backup cannot see the screen", () => {
  assert.ok(BACKUP_SYSTEM_PROMPT.includes("ห้ามระบุชื่อเมนู"));
});

console.log(`\n${n} checks passed`);
