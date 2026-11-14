// Checks when น้องวีบอท uses the AI and when it switches to the quick actions, and the failure kinds behind it.
// Run: node --experimental-strip-types scripts/check-ai-engine.mjs
import assert from "node:assert/strict";
import {
  DOWN_RETRY_MS,
  FALLBACK_NOT_UNDERSTOOD,
  FALLBACK_REPLY,
  capLevel,
  decideEngine,
  monthStartBangkok,
  readCap,
  usagePercent,
} from "../src/features/ai/engine-state.ts";
import { classifyAiFailure, isLastingFailure } from "../src/features/ai/ai-error.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const NOW = Date.UTC(2026, 10, 14, 5, 0, 0);
const ok = { state: "ok" };

check("the cap setting must be a positive whole number, anything else means no cap", () => {
  assert.equal(readCap("500"), 500);
  assert.equal(readCap(" 40 "), 40);
  for (const bad of [undefined, null, "", "0", "-3", "1.5", "abc", "10 000"]) assert.equal(readCap(bad), null, String(bad));
});
check("the AI answers while healthy and under the cap", () => {
  assert.deepEqual(decideEngine({ health: ok, used: 10, cap: 500, now: NOW }), { mode: "ai" });
  assert.deepEqual(decideEngine({ health: ok, used: 9999, cap: null, now: NOW }), { mode: "ai" }, "no cap, never full");
});
check("a full cap goes to the fallback, even when the service is healthy", () => {
  assert.deepEqual(decideEngine({ health: ok, used: 500, cap: 500, now: NOW }), { mode: "fallback", reason: "cap" });
  assert.deepEqual(decideEngine({ health: ok, used: 501, cap: 500, now: NOW }), { mode: "fallback", reason: "cap" });
  assert.deepEqual(decideEngine({ health: ok, used: 499, cap: 500, now: NOW }), { mode: "ai" });
});
check("after a lasting failure the fallback answers until the retry time, then the AI is tried again", () => {
  const down = { state: "down", since: NOW - 60_000, reason: "credit" };
  assert.deepEqual(decideEngine({ health: down, used: 1, cap: 500, now: NOW }), { mode: "fallback", reason: "credit" });
  const key = { state: "down", since: NOW - 1000, reason: "key" };
  assert.deepEqual(decideEngine({ health: key, used: 1, cap: 500, now: NOW }), { mode: "fallback", reason: "key" });
  const old = { state: "down", since: NOW - DOWN_RETRY_MS, reason: "credit" };
  assert.deepEqual(decideEngine({ health: old, used: 1, cap: 500, now: NOW }), { mode: "ai" }, "exactly at the retry time the AI is probed");
});
check("the cap reason wins when both the cap is full and the service is down", () => {
  const down = { state: "down", since: NOW - 1000, reason: "credit" };
  assert.deepEqual(decideEngine({ health: down, used: 500, cap: 500, now: NOW }), { mode: "fallback", reason: "cap" });
});
check("warning levels are 0, 80 and 100 and never move down as use grows", () => {
  assert.equal(capLevel(79, 100), 0);
  assert.equal(capLevel(80, 100), 80);
  assert.equal(capLevel(99, 100), 80);
  assert.equal(capLevel(100, 100), 100);
  assert.equal(capLevel(150, 100), 100);
  assert.equal(capLevel(50, null), 0);
  assert.equal(usagePercent(1, 3), 33);
  assert.equal(usagePercent(5, null), 0);
});
check("the month starts at midnight Bangkok time, not UTC", () => {
  // 31 Oct 18:00 UTC is already 1 Nov 01:00 in Bangkok.
  assert.equal(monthStartBangkok(new Date(Date.UTC(2026, 9, 31, 18, 0, 0))).toISOString(), "2026-10-31T17:00:00.000Z");
  // 14 Nov 05:00 UTC is 14 Nov 12:00 in Bangkok, so November started at 31 Oct 17:00 UTC.
  assert.equal(monthStartBangkok(new Date(NOW)).toISOString(), "2026-10-31T17:00:00.000Z");
  // 30 Nov 20:00 UTC is 1 Dec 03:00 in Bangkok.
  assert.equal(monthStartBangkok(new Date(Date.UTC(2026, 10, 30, 20, 0, 0))).toISOString(), "2026-11-30T17:00:00.000Z");
});
check("only credit and key failures count as lasting; a busy service or other error does not switch the mode", () => {
  assert.equal(classifyAiFailure(400, "Your credit balance is too low"), "credit");
  assert.equal(classifyAiFailure(401, "invalid x-api-key"), "key");
  assert.equal(classifyAiFailure(403, "forbidden"), "key");
  assert.equal(classifyAiFailure(429, "rate_limit_error"), "limit");
  assert.equal(classifyAiFailure(529, "overloaded_error"), "busy");
  assert.equal(classifyAiFailure(500, "boom"), "other");
  for (const k of ["credit", "key"]) assert.equal(isLastingFailure(k), true, k);
  for (const k of ["limit", "busy", "other"]) assert.equal(isLastingFailure(k), false, k);
});
check("every fallback message names the buttons and has no English words for staff", () => {
  for (const reason of ["credit", "key", "cap"]) {
    const t = FALLBACK_REPLY[reason];
    assert.match(t, /ปุ่มลัด/);
    assert.match(t, /ไม่ใช้ AI/);
    assert.doesNotMatch(t.replace(/AI|PDF/g, ""), /[A-Za-z]{3,}/, reason);
  }
  assert.match(FALLBACK_NOT_UNDERSTOOD, /ปุ่มลัด/);
});

console.log(`\n${n} checks passed`);
