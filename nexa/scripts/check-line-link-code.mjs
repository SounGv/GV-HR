// Checks which chat messages the HR LINE webhook treats as an account-link code, with made-up text only.
// Run: node --experimental-strip-types scripts/check-line-link-code.mjs
import assert from "node:assert/strict";
import { generateLinkCode, isLinkCodeText, shouldRegisterHrGroups } from "../src/lib/integrations/line.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("every generated link code is recognised, in either case and with spaces around it", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateLinkCode();
    assert.equal(isLinkCodeText(code), true, code);
    assert.equal(isLinkCodeText(` ${code.toLowerCase()} \n`), true, code);
  }
});
check("normal chat is not a link code, so the bot stays silent", () => {
  for (const text of ["สวัสดี", "ขอรายงานยอดขาย", "hello", "ok", "12345", "1234567", "ABCDE", "ABC DEF", "รหัส ABCDEF", "", "   "]) {
    assert.equal(isLinkCodeText(text), false, text);
  }
});
check("characters left out of the code alphabet (0, 1, I, O) never match", () => {
  for (const text of ["ABCDE0", "ABCDE1", "ABCDEI", "ABCDEO"]) assert.equal(isLinkCodeText(text), false, text);
});
check("missing text is not a link code", () => {
  assert.equal(isLinkCodeText(undefined), false);
  assert.equal(isLinkCodeText(null), false);
});
check("HR groups are only registered when the flag is set to true", () => {
  const before = process.env.LINE_REGISTER_HR_GROUPS;
  delete process.env.LINE_REGISTER_HR_GROUPS;
  assert.equal(shouldRegisterHrGroups(), false);
  process.env.LINE_REGISTER_HR_GROUPS = "false";
  assert.equal(shouldRegisterHrGroups(), false);
  process.env.LINE_REGISTER_HR_GROUPS = "true";
  assert.equal(shouldRegisterHrGroups(), true);
  if (before === undefined) delete process.env.LINE_REGISTER_HR_GROUPS;
  else process.env.LINE_REGISTER_HR_GROUPS = before;
});

console.log(`\n${n} checks passed`);
