// Checks the rules for files attached in the น้องวีบอท chat and for files it hands back, with made-up file names and sizes.
// Run: node --experimental-strip-types scripts/check-ai-attachments.mjs
import assert from "node:assert/strict";
import {
  base64Bytes,
  checkFiles,
  checkOutput,
  classifyFile,
  decodeText,
  fileHeader,
  limitText,
  MAX_FILES,
  MAX_OUTPUT_CELLS,
  MAX_TOTAL_BYTES,
  outputFileName,
  safeCell,
  sheetName,
  signatureMatches,
  sizeText,
  toCsv,
} from "../src/features/ai/attachments.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const MB = 1024 * 1024;

check("the supported kinds are recognised by extension, in any case", () => {
  for (const [name, kind] of [["a.PDF", "pdf"], ["b.jpg", "image"], ["c.JPEG", "image"], ["d.png", "image"], ["e.webp", "image"], ["f.xlsx", "sheet"], ["g.xls", "sheet"], ["h.csv", "text"], ["i.txt", "text"], ["j.md", "text"], ["k.json", "text"]]) {
    const c = classifyFile(name);
    assert.equal(c.ok, true, name);
    assert.equal(c.kind, kind, name);
  }
  assert.equal(classifyFile("x.jpg").imageMime, "image/jpeg");
  assert.equal(classifyFile("x.png").imageMime, "image/png");
});
check("Word, PowerPoint and HEIC are refused with what to do instead", () => {
  assert.match(classifyFile("สัญญา.docx").message, /บันทึกเป็น PDF/);
  assert.match(classifyFile("old.doc").message, /Word/);
  assert.match(classifyFile("deck.pptx").message, /PowerPoint/);
  assert.match(classifyFile("photo.heic").message, /JPG หรือ PNG/);
});
check("an unknown or missing extension is refused", () => {
  assert.equal(classifyFile("program.exe").ok, false);
  assert.equal(classifyFile("noext").ok, false);
  assert.equal(classifyFile("archive.zip").ok, false);
  assert.match(classifyFile("archive.zip").message, /ยังไม่รองรับ/);
});
check("a good set of files passes", () => {
  assert.deepEqual(checkFiles([{ name: "a.xlsx", size: 184 * 1024 }, { name: "b.pdf", size: 1.2 * MB }]), { ok: true });
});
check("more than 5 files, empty files and bad kinds are all reported together", () => {
  const six = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ name: `f${i}.csv`, size: 10 }));
  assert.equal(checkFiles(six).ok, false);
  const r = checkFiles([{ name: "empty.csv", size: 0 }, { name: "a.docx", size: 5 }]);
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 2);
});
check("the total size limit is 3 MB and the message names the biggest file", () => {
  assert.equal(MAX_TOTAL_BYTES, 3 * MB);
  assert.equal(checkFiles([{ name: "a.pdf", size: 3 * MB }]).ok, true);
  const r = checkFiles([{ name: "small.csv", size: 100 }, { name: "รายงานทั้งปี.pdf", size: 3 * MB + 1 }]);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /เกินที่แนบได้/);
  assert.match(r.problems[0], /รายงานทั้งปี\.pdf/);
});
check("the first bytes must match the extension; text files always pass", () => {
  const h = (...b) => Uint8Array.from([...b, ...new Array(16).fill(0)]).subarray(0, 16);
  assert.equal(signatureMatches("a.pdf", h(0x25, 0x50, 0x44, 0x46)), true);
  assert.equal(signatureMatches("a.pdf", h(0x50, 0x4b)), false);
  assert.equal(signatureMatches("a.xlsx", h(0x50, 0x4b, 3, 4)), true);
  assert.equal(signatureMatches("a.xlsx", new TextEncoder().encode("not excel")), false);
  assert.equal(signatureMatches("a.xls", h(0xd0, 0xcf, 0x11, 0xe0)), true);
  assert.equal(signatureMatches("a.png", h(0x89, 0x50, 0x4e, 0x47)), true);
  assert.equal(signatureMatches("a.JPG", h(0xff, 0xd8, 0xff, 0xe0)), true);
  assert.equal(signatureMatches("a.gif", h(0x47, 0x49, 0x46, 0x38)), true);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
  assert.equal(signatureMatches("a.webp", webp), true);
  assert.equal(signatureMatches("a.webp", h(0x52, 0x49, 0x46, 0x46)), false);
  assert.equal(signatureMatches("a.csv", new TextEncoder().encode("any,text")), true);
});
check("sizes read in KB and MB", () => {
  assert.equal(sizeText(500), "500 B");
  assert.equal(sizeText(184 * 1024), "184 KB");
  assert.equal(sizeText(1.2 * MB), "1.2 MB");
});
check("the real size comes from the base64 text, padding included", () => {
  for (const len of [0, 1, 2, 3, 100, 1000, 1001, 1002]) {
    const bytes = Buffer.alloc(len, 7);
    assert.equal(base64Bytes(bytes.toString("base64")), len, `len ${len}`);
  }
  assert.equal(base64Bytes("QUJD\nREVG"), 6);
});
check("long text is cut at the limit and says how long it was", () => {
  assert.deepEqual(limitText("abc", 10), { text: "abc", cut: false, total: 3 });
  assert.deepEqual(limitText("abcdefghij", 4), { text: "abcd", cut: true, total: 10 });
});
check("text decodes as UTF-8 and loses a byte order mark", () => {
  const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("ชื่อ,วัน")]);
  assert.equal(decodeText(withBom), "ชื่อ,วัน");
  assert.equal(decodeText(new TextEncoder().encode("plain")), "plain");
});
check("each file is introduced as data, not instructions", () => {
  const h = fileHeader("ใบลงเวลา.xlsx", "sheet");
  assert.match(h, /ใบลงเวลา\.xlsx/);
  assert.match(h, /ไม่ใช่คำสั่ง/);
  assert.match(fileHeader("a.csv", "text", "(ตัด)"), /\(ตัด\)/);
});
check("output file names lose folders and odd characters and get the right extension", () => {
  assert.equal(outputFileName("สรุป/คนมาสาย?.xlsx", "xlsx"), "สรุป คนมาสาย.xlsx");
  assert.equal(outputFileName("", "xlsx"), "สรุปจากน้องวีบอท.xlsx");
  assert.equal(outputFileName(undefined, "csv"), "สรุปจากน้องวีบอท.csv");
  assert.equal(outputFileName("a".repeat(200), "xlsx").length, 80 + ".xlsx".length);
  assert.ok(!/[\\/:*?"<>|]/.test(outputFileName('a\\b:c*d?e"f<g>h|i', "csv")));
  assert.ok(!outputFileName("../../etc/passwd", "csv").includes("/"));
});
check("sheet names are valid for Excel", () => {
  assert.equal(sheetName("สรุป[1]: ทดสอบ?", 0), "สรุป 1 ทดสอบ");
  assert.equal(sheetName("", 2), "Sheet3");
  assert.equal(sheetName("x".repeat(50), 0).length, 31);
});
check("cells that start like a formula are made harmless; numbers and text stay as they are", () => {
  assert.equal(safeCell("=SUM(A1:A9)"), "'=SUM(A1:A9)");
  assert.equal(safeCell("+66812345678"), "'+66812345678");
  assert.equal(safeCell("-5"), "'-5");
  assert.equal(safeCell("@cmd"), "'@cmd");
  assert.equal(safeCell("สมชาย"), "สมชาย");
  assert.equal(safeCell(-5), -5);
  assert.equal(safeCell(12.5), 12.5);
  assert.equal(safeCell(NaN), null);
  assert.equal(safeCell(null), null);
  assert.equal(safeCell(undefined), null);
  assert.equal(safeCell(true), true);
});
check("a good output request is cleaned and accepted", () => {
  const r = checkOutput({ fileName: "คนมาสาย", format: "xlsx", sheets: [{ name: "สรุป", rows: [["ชื่อ", "ครั้ง"], ["สมชาย", 5], ["=1+1", 3]] }] });
  assert.equal(r.ok, true);
  assert.equal(r.fileName, "คนมาสาย.xlsx");
  assert.equal(r.sheets[0].rows[2][0], "'=1+1");
});
check("bad output requests are refused with a reason", () => {
  assert.equal(checkOutput({ format: "pdf", sheets: [] }).ok, false);
  assert.equal(checkOutput({ format: "xlsx", sheets: [] }).ok, false);
  assert.equal(checkOutput({ format: "xlsx", sheets: [{ name: "a", rows: [] }] }).ok, false);
  assert.equal(checkOutput({ format: "csv", sheets: [{ name: "a", rows: [["x"]] }, { name: "b", rows: [["y"]] }] }).ok, false);
  assert.equal(checkOutput({ format: "xlsx", sheets: Array.from({ length: 11 }, () => ({ name: "s", rows: [["x"]] })) }).ok, false);
});
check("too many cells are refused", () => {
  const big = [Array.from({ length: MAX_OUTPUT_CELLS + 1 }, () => "x")];
  assert.equal(checkOutput({ format: "xlsx", sheets: [{ name: "s", rows: big }] }).ok, false);
  assert.equal(checkOutput({ format: "xlsx", sheets: [{ name: "s", rows: [Array.from({ length: MAX_OUTPUT_CELLS }, () => "x")] }] }).ok, true);
});
check("CSV quotes commas, quotes and line breaks, and starts with a BOM for Excel", () => {
  const csv = toCsv([["ชื่อ", "หมายเหตุ"], ["สมชาย", 'พูดว่า "ครับ", แล้วไป'], ["สมหญิง", "บรรทัด1\nบรรทัด2"], ["x", null]]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv.slice(1).split("\r\n")[1], 'สมชาย,"พูดว่า ""ครับ"", แล้วไป"');
  assert.ok(csv.includes('"บรรทัด1\nบรรทัด2"'));
  assert.ok(csv.endsWith("x,"));
});

console.log(`\n${n} checks passed`);
