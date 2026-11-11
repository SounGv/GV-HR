// Pure check for reply-parts: node --experimental-strip-types scripts/check-reply-parts.mjs
import assert from "node:assert/strict";
import { splitSummary, firstHeading, withoutFirstHeading } from "../src/features/ai/reply-parts.ts";

const reply = "เดือนนี้คนมาสายมากที่สุดคือ ตัวอย่าง หนึ่ง 3 ครั้ง\nส่วนคนลามากสุดคือ ตัวอย่าง สี่\n\n## สรุปการลงเวลา พ.ย.\n\n| ชื่อ | ครั้ง |\n|---|---|\n| ก | 3 |";
const parts = splitSummary(reply);
assert.equal(parts.summary, "เดือนนี้คนมาสายมากที่สุดคือ ตัวอย่าง หนึ่ง 3 ครั้ง ส่วนคนลามากสุดคือ ตัวอย่าง สี่");
assert.ok(parts.rest.startsWith("## สรุปการลงเวลา"));
assert.equal(firstHeading(reply), "สรุปการลงเวลา พ.ย.");
// A reply that opens with a heading has no prose summary to lift out.
assert.deepEqual(splitSummary("## หัวข้อ\nเนื้อหา"), { summary: "", rest: "## หัวข้อ\nเนื้อหา" });
assert.deepEqual(splitSummary("ตอบสั้นๆ บรรทัดเดียว"), { summary: "ตอบสั้นๆ บรรทัดเดียว", rest: "" });
assert.equal(firstHeading("ไม่มีหัวข้อ"), null);
assert.equal(withoutFirstHeading("## หัวข้อ\n\n| a |\n|---|\n| 1 |"), "| a |\n|---|\n| 1 |");
assert.equal(withoutFirstHeading("ไม่มีหัวข้อ"), "ไม่มีหัวข้อ");
console.log("reply parts ok");
