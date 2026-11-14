// Checks what staff are told when the AI service fails, with the real message the service sent on 14 Nov 2026.
// Run: node --experimental-strip-types scripts/check-ai-error.mjs
import assert from "node:assert/strict";
import { AI_FAILURE_DEFAULT, describeAiFailure } from "../src/features/ai/ai-error.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const CREDIT = '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';

check("an empty AI account says credit is out and who must act, not the raw English", () => {
  const t = describeAiFailure(400, CREDIT);
  assert.match(t, /เครดิต/);
  assert.match(t, /ผู้ดูแลระบบ/);
  assert.doesNotMatch(t, /[A-Za-z]{4,}/, "no English words for staff");
});
check("a bad or missing key says the connection setting needs the administrator", () => {
  for (const [s, m] of [[401, "invalid x-api-key"], [403, "forbidden"], [undefined, "authentication_error: invalid x-api-key"]]) {
    assert.match(describeAiFailure(s, m), /รหัสเชื่อมต่อ/);
  }
});
check("too many requests and a busy service ask the person to wait", () => {
  assert.match(describeAiFailure(429, "rate_limit_error"), /รอสักครู่/);
  assert.match(describeAiFailure(529, "overloaded_error"), /รอสักครู่/);
  assert.match(describeAiFailure(503, ""), /รอสักครู่/);
});
check("anything else keeps the general message", () => {
  assert.equal(describeAiFailure(500, "boom"), AI_FAILURE_DEFAULT);
  assert.equal(describeAiFailure(undefined, "socket hang up"), AI_FAILURE_DEFAULT);
  assert.equal(describeAiFailure(400, "some other bad request"), AI_FAILURE_DEFAULT);
});
check("billing wins over the status code", () => {
  assert.match(describeAiFailure(429, "credit balance is too low"), /เครดิต/);
});

console.log(`\n${n} checks passed`);
