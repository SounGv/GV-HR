// Checks which address links in LINE messages and emails point to, with made-up domains only.
// Run: node --experimental-strip-types scripts/check-app-url.mjs
import assert from "node:assert/strict";
import { appBaseUrl } from "../src/lib/app-url.ts";

let n = 0;
const check = (name, fn) => {
  const saved = { a: process.env.APP_URL, v: process.env.VERCEL_PROJECT_PRODUCTION_URL };
  delete process.env.APP_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  try {
    fn();
  } finally {
    if (saved.a === undefined) delete process.env.APP_URL; else process.env.APP_URL = saved.a;
    if (saved.v === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL; else process.env.VERCEL_PROJECT_PRODUCTION_URL = saved.v;
  }
  n++;
  console.log(`ok  ${name}`);
};

check("APP_URL wins, without a trailing slash", () => {
  process.env.APP_URL = "https://hr.example.com/";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "other.example.com";
  assert.equal(appBaseUrl(), "https://hr.example.com");
});
check("without APP_URL, the Vercel production domain is used over https", () => {
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "hr.example.com";
  assert.equal(appBaseUrl(), "https://hr.example.com");
});
check("a Vercel value that already has https:// is not doubled", () => {
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "https://hr.example.com/";
  assert.equal(appBaseUrl(), "https://hr.example.com");
});
check("blank values are ignored", () => {
  process.env.APP_URL = "   ";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "";
  assert.equal(appBaseUrl(), "http://localhost:3000");
});
check("on a developer machine with nothing set it is localhost", () => {
  assert.equal(appBaseUrl(), "http://localhost:3000");
});

console.log(`\n${n} checks passed`);
