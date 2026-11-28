// Checks the pure input rules: shift times and which attachment kinds the server accepts.
// Run: node --experimental-strip-types scripts/check-input-rules.mjs
import assert from "node:assert/strict";
import { shiftTemplateProblem } from "../src/features/shift/template-rules.ts";
import { DATA_URL_FILE_RE } from "../src/lib/image-schema.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a normal day shift and a night shift are fine", () => {
  assert.equal(shiftTemplateProblem("09:00", "18:00", 60), null);
  assert.equal(shiftTemplateProblem("22:00", "06:00", 60), null, "ends next morning: a night shift");
});
check("start equal to end is refused (it would read as 24 hours)", () => {
  assert.match(shiftTemplateProblem("09:00", "09:00", 0), /ไม่เท่ากัน/);
});
check("a break as long as, or longer than, the shift is refused", () => {
  assert.match(shiftTemplateProblem("09:00", "10:00", 60), /ต้องสั้นกว่า/);
  assert.match(shiftTemplateProblem("09:00", "10:00", 90), /ต้องสั้นกว่า/);
  assert.equal(shiftTemplateProblem("09:00", "10:00", 59), null);
  assert.match(shiftTemplateProblem("22:00", "06:00", 480), /ต้องสั้นกว่า/, "night shift length is 480 minutes");
});
check("attachments: pictures, PDF and Word pass", () => {
  for (const t of ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]) {
    assert.ok(DATA_URL_FILE_RE.test(`data:${t};base64,AAAA`), t);
  }
});
check("attachments: programs, scripts and other kinds are refused", () => {
  for (const t of ["application/x-msdownload", "application/x-msdos-program", "application/octet-stream", "text/html", "image/svg+xml", "application/javascript", "application/zip", "application/x-sh"]) {
    assert.ok(!DATA_URL_FILE_RE.test(`data:${t};base64,AAAA`), t);
  }
});

console.log(`\n${n} checks passed`);
