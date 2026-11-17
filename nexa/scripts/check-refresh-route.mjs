// The refresh route must only clear the session cookies when the token is really no good.
//   - an Unauthorized answer from the service        -> 401 / redirect to /login, cookies cleared
//   - a database error or any other failure          -> 503 / a waiting page, cookies NOT touched
//   - the page version never loops forever, and never follows a redirect that leaves the site
// Pure local: the refresh service is replaced by a scripted stand-in; nothing reaches a database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const NEXA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(NEXA, "package.json"));
const { build } = require("esbuild");
// Inside the app folder (git-ignored) so the bundle can find next and prisma.
const dir = path.join(NEXA, ".tmp-e2e");
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, "refresh-route-check.cjs");
await build({
  entryPoints: [path.join(NEXA, "src/app/api/auth/refresh/route.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  alias: { "@": path.join(NEXA, "src") },
  nodePaths: [path.join(NEXA, "node_modules")],
  external: ["next", "next/*", "@prisma/client", ".prisma/client", "server-only", "jose", "bcryptjs"],
  plugins: [
    {
      name: "stub-service",
      setup(b) {
        b.onResolve({ filter: /^@\/lib\/auth\/service$/ }, () => ({ path: "stub-service", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export async function refresh() { return globalThis.__refresh(); }",
          loader: "js",
        }));
      },
    },
  ],
  logLevel: "error",
});
const { POST, GET } = require(out);
const { NextRequest } = require("next/server");
const { Prisma } = require("@prisma/client");

const req = (method, url) => new NextRequest(url, { method, headers: { cookie: "nexa_rt=abc" } });
const setCookies = (res) => res.headers.getSetCookie?.() ?? [];
const cleared = (res) => setCookies(res).some((c) => /nexa_rt=;/.test(c) || /Max-Age=0/i.test(c));
const results = [];
console.error = () => {}; // the route logs the failures it keeps the session through; not needed here
async function t(name, fn) {
  try {
    await fn();
    results.push([true, name]);
  } catch (e) {
    results.push([false, `${name} :: ${e.message}`]);
  }
}

const dbDown = () => new Prisma.PrismaClientKnownRequestError("Timed out fetching a new connection", { code: "P2024", clientVersion: "6" });

// POST with no cookie throws the real Unauthorized inside the route, which is the "definitely over" case.
await t("POST without a refresh cookie answers 401 and clears the cookies", async () => {
  const res = await POST(new NextRequest("http://x/api/auth/refresh", { method: "POST" }));
  assert.equal(res.status, 401);
  assert.ok(cleared(res), "cookies cleared");
});

await t("POST when the database times out answers 503 and leaves the cookies alone", async () => {
  globalThis.__refresh = async () => {
    throw dbDown();
  };
  const res = await POST(req("POST", "http://x/api/auth/refresh"));
  assert.equal(res.status, 503);
  assert.equal(setCookies(res).length, 0, "no Set-Cookie at all");
});

await t("POST with an unexpected bug also keeps the session", async () => {
  globalThis.__refresh = async () => {
    throw new TypeError("boom");
  };
  const res = await POST(req("POST", "http://x/api/auth/refresh"));
  assert.equal(res.status, 503);
  assert.equal(setCookies(res).length, 0);
});

await t("GET page version, database down: a waiting page that asks again, no redirect to login, cookies kept", async () => {
  globalThis.__refresh = async () => {
    throw dbDown();
  };
  const res = await GET(req("GET", "http://x/api/auth/refresh?redirect=/leave"));
  assert.equal(res.status, 503);
  assert.equal(setCookies(res).length, 0);
  const html = await res.text();
  assert.match(html, /http-equiv="refresh"/);
  assert.match(html, /try=1/);
  assert.match(html, /redirect=%2Fleave|redirect=\/leave/);
});

await t("GET page version gives up automatically after 3 tries but still keeps the cookies", async () => {
  globalThis.__refresh = async () => {
    throw dbDown();
  };
  const res = await GET(req("GET", "http://x/api/auth/refresh?redirect=/leave&try=3"));
  assert.equal(res.status, 503);
  assert.equal(setCookies(res).length, 0);
  assert.doesNotMatch(await res.text(), /http-equiv="refresh"/, "no more automatic retries");
});

await t("GET page version without a cookie goes to login and clears (the token is definitely missing)", async () => {
  const res = await GET(new NextRequest("http://x/api/auth/refresh?redirect=/leave"));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location") ?? "", /\/login\?redirect=%2Fleave/);
  assert.ok(cleared(res));
});

await t("a redirect target that leaves the site is replaced by /dashboard", async () => {
  globalThis.__refresh = async () => ({ accessToken: "a", refreshToken: "r", remember: true, claims: {} });
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com"]) {
    const res = await GET(req("GET", `http://x/api/auth/refresh?redirect=${encodeURIComponent(bad)}`));
    assert.equal(new URL(res.headers.get("location")).pathname, "/dashboard", `for ${bad}`);
    assert.equal(new URL(res.headers.get("location")).host, "x");
  }
  const ok = await GET(req("GET", "http://x/api/auth/refresh?redirect=%2Fleave%2F123"));
  assert.equal(new URL(ok.headers.get("location")).pathname, "/leave/123");
});

for (const [ok, name] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
