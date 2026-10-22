// Checks the group-alert sender for gv-api-gateway against a local stand-in server, with made-up keys and ids only.
// Run: node --experimental-strip-types scripts/check-line-gateway.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { idempotencyKeyFor, pushViaGateway, readGatewayConfig } from "../src/lib/integrations/line-gateway.ts";

let n = 0;
const check = async (name, fn) => {
  await fn();
  n++;
  console.log(`ok  ${name}`);
};

await check("without all three settings the gateway is off and the old path is used", () => {
  assert.equal(readGatewayConfig({}), null);
  assert.equal(readGatewayConfig({ GV_GATEWAY_URL: "https://x.example", GV_GATEWAY_API_KEY: "" }), null);
  assert.equal(readGatewayConfig({ GV_GATEWAY_API_KEY: "k" }), null);
});
await check("the address needs https, except the developer's own machine", () => {
  assert.equal(readGatewayConfig({ GV_GATEWAY_URL: "http://api.example.com", GV_GATEWAY_API_KEY: "k" }), null);
  assert.ok(readGatewayConfig({ GV_GATEWAY_URL: "https://api.example.com/", GV_GATEWAY_API_KEY: "k" }));
  assert.ok(readGatewayConfig({ GV_GATEWAY_URL: "http://127.0.0.1:8003", GV_GATEWAY_API_KEY: "k" }));
});
await check("group ids are split on commas, trimmed, and empty ones dropped", () => {
  const c = readGatewayConfig({ GV_GATEWAY_URL: "https://a.example/", GV_GATEWAY_API_KEY: " k ", GV_GATEWAY_LINE_GROUP_IDS: " C1 ,, C2 ," });
  assert.deepEqual(c.groupIds, ["C1", "C2"]);
  assert.equal(c.url, "https://a.example");
  assert.equal(c.apiKey, "k");
  assert.deepEqual(readGatewayConfig({ GV_GATEWAY_URL: "https://a.example", GV_GATEWAY_API_KEY: "k" }).groupIds, []);
});
await check("the same message to the same group gets the same key; a different one does not", () => {
  assert.equal(idempotencyKeyFor("C1", "hello"), idempotencyKeyFor("C1", "hello"));
  assert.notEqual(idempotencyKeyFor("C1", "hello"), idempotencyKeyFor("C2", "hello"));
  assert.notEqual(idempotencyKeyFor("C1", "hello"), idempotencyKeyFor("C1", "hello!"));
});

// A stand-in for the gateway, answering by the last character of the text it receives.
const seen = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    seen.push({ url: req.url, method: req.method, key: req.headers["x-gv-api-key"], idem: req.headers["x-gv-idempotency-key"], body: parsed });
    const status = { "1": 503, "2": 403, "3": 401, "4": 429 }[String(parsed.text).slice(-1)] ?? 200;
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(status === 200 ? { ok: true, line_status: 200 } : { detail: "no" }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const config = { url: `http://127.0.0.1:${server.address().port}`, apiKey: "test-key", groupIds: ["Ctest"] };

await check("a post goes to /v1/line/push with the key, an idempotency key and the exact text", async () => {
  const text = "📋 มีคำขอลารออนุมัติ\nตัวอย่าง ขอลากิจ 1 วัน";
  const r = await pushViaGateway(config, "Cgroup", text);
  assert.deepEqual(r, { ok: true, status: 200 });
  const s = seen.at(-1);
  assert.equal(s.url, "/v1/line/push");
  assert.equal(s.method, "POST");
  assert.equal(s.key, "test-key");
  assert.equal(s.idem, idempotencyKeyFor("Cgroup", text));
  assert.deepEqual(s.body, { to: "Cgroup", text });
});
await check("a long text is cut to what the gateway accepts", async () => {
  await pushViaGateway(config, "Cgroup", "x".repeat(6000));
  assert.equal(seen.at(-1).body.text.length, 4900);
});
await check("switch off (503), not allowed (403), wrong key (401) and limit reached (429) come back as failures, never as errors", async () => {
  for (const [last, status] of [["1", 503], ["2", 403], ["3", 401], ["4", 429]]) {
    const r = await pushViaGateway(config, "Cgroup", `message ${last}`);
    assert.equal(r.ok, false);
    assert.equal(r.status, status);
    assert.ok(r.reason);
  }
});
server.close();
await check("an unreachable gateway is a failure, not a thrown error", async () => {
  const r = await pushViaGateway({ url: "http://127.0.0.1:1", apiKey: "k", groupIds: [] }, "Cgroup", "hi", 1500);
  assert.equal(r.ok, false);
  assert.equal(r.status, 0);
});

console.log(`\n${n} checks passed`);
