// Checks that LINE_PAUSED=true switches every LINE send off without touching the token or secret.
// Run: node --experimental-strip-types scripts/check-line-pause.mjs
import assert from "node:assert/strict";
import { isLineConfigured, sendLinePush, pushLineMessage, pushLineGroupMessage } from "../src/lib/integrations/line.ts";

let n = 0;
const check = async (name, fn) => {
  await fn();
  n++;
  console.log(`ok  ${name}`);
};
const keep = { t: process.env.LINE_CHANNEL_ACCESS_TOKEN, s: process.env.LINE_CHANNEL_SECRET, p: process.env.LINE_PAUSED };
const restore = () => {
  for (const [k, v] of [["LINE_CHANNEL_ACCESS_TOKEN", keep.t], ["LINE_CHANNEL_SECRET", keep.s], ["LINE_PAUSED", keep.p]]) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};
process.env.LINE_CHANNEL_ACCESS_TOKEN = "token";
process.env.LINE_CHANNEL_SECRET = "secret";
delete process.env.LINE_PAUSED;

await check("with token and secret and no pause, LINE is on", () => {
  assert.equal(isLineConfigured(), true);
});
await check("LINE_PAUSED=true turns it off while token and secret stay set", () => {
  process.env.LINE_PAUSED = "true";
  assert.equal(isLineConfigured(), false);
  assert.equal(process.env.LINE_CHANNEL_ACCESS_TOKEN, "token");
});
await check("any other value of LINE_PAUSED does not pause", () => {
  for (const v of ["false", "", "1", "TRUE"]) {
    process.env.LINE_PAUSED = v;
    assert.equal(isLineConfigured(), true, `value "${v}"`);
  }
});
await check("while paused, every send returns without calling LINE", async () => {
  process.env.LINE_PAUSED = "true";
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 200 });
  };
  try {
    await sendLinePush("U1", "x");
    await pushLineMessage("U1", "x");
    await pushLineGroupMessage("C1", "x");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});
restore();
console.log(`\n${n} checks passed`);
