// The browser's API helper must not sign anyone out because a refresh could not be answered:
//   - refresh says 401 (session really over)        -> the person is sent to /login
//   - refresh answers 503 or the network fails      -> no redirect; a later success is retried into the original request
// Pure local: bundles src/lib/api/client.ts and runs it against a scripted fetch.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";

const NEXA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = createRequire(path.join(NEXA, "package.json"))("esbuild");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "api-refresh-")), "client.mjs");
await build({
  entryPoints: [path.join(NEXA, "src/lib/api/client.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  alias: { "@": path.join(NEXA, "src") },
  logLevel: "error",
});
const { api } = await import(pathToFileURL(out).href);

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let script = [];
let calls = [];
globalThis.document = { cookie: "nexa_csrf=abc" };
globalThis.window = { location: { pathname: "/dashboard", href: "/dashboard" } };
globalThis.fetch = async (url) => {
  calls.push(String(url));
  const next = script.shift();
  if (!next) throw new Error("no scripted answer for " + url);
  if (next === "network") throw new TypeError("Failed to fetch");
  return next;
};
const reset = async (answers) => {
  await new Promise((resolve) => setTimeout(resolve, 5)); // the helper forgets a finished refresh on the next tick
  script = answers;
  calls = [];
  globalThis.window.location.href = "/dashboard";
};
const results = [];
async function t(name, fn) {
  try {
    await fn();
    results.push([true, name]);
  } catch (e) {
    results.push([false, name + " :: " + e.message]);
  }
}

await t("a refresh the server answers with 401 sends the person to sign in", async () => {
  await reset([json(401, { error: { code: "UNAUTHORIZED", message: "x" } }), json(401, { error: { code: "UNAUTHORIZED", message: "เซสชันหมดอายุ" } })]);
  await assert.rejects(() => api.get("/api/leave"));
  assert.equal(window.location.href, "/login");
});

await t("a refresh that is unavailable three times keeps the person signed in", async () => {
  await reset([json(401, { error: { code: "UNAUTHORIZED", message: "x" } }), json(503, {}), json(503, {}), json(503, {})]);
  await assert.rejects(() => api.get("/api/leave"));
  assert.equal(window.location.href, "/dashboard", "no redirect to /login");
  assert.equal(calls.filter((c) => c.includes("/api/auth/refresh")).length, 3, "tried 3 times");
});

await t("a dropped connection during the refresh does not sign the person out", async () => {
  await reset([json(401, { error: { code: "UNAUTHORIZED", message: "x" } }), "network", "network", "network"]);
  await assert.rejects(() => api.get("/api/leave"));
  assert.equal(window.location.href, "/dashboard");
});

await t("a refresh that fails once and then works lets the original request go through", async () => {
  await reset([json(401, { error: { code: "UNAUTHORIZED", message: "x" } }), json(503, {}), json(200, { data: { user: {} } }), json(200, { data: [1, 2, 3] })]);
  const res = await api.get("/api/leave");
  assert.deepEqual(res.data, [1, 2, 3]);
  assert.equal(window.location.href, "/dashboard");
});

for (const [ok, name] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
