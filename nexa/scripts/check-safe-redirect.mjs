// The page we go to after sign-in must stay on this site.
// Run: node --experimental-strip-types scripts/check-safe-redirect.mjs
import assert from "node:assert/strict";
import { safeRedirectPath } from "../src/lib/auth/redirect.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a path inside the site is kept, with its query", () => {
  assert.equal(safeRedirectPath("/leave/new"), "/leave/new");
  assert.equal(safeRedirectPath("/reports?view=attendance&month=2026-11"), "/reports?view=attendance&month=2026-11");
});

check("nothing, an empty value or a relative word gives the fallback", () => {
  assert.equal(safeRedirectPath(null), "/dashboard");
  assert.equal(safeRedirectPath(undefined), "/dashboard");
  assert.equal(safeRedirectPath(""), "/dashboard");
  assert.equal(safeRedirectPath("evil.com"), "/dashboard");
  assert.equal(safeRedirectPath("dashboard"), "/dashboard");
});

check("anything that leaves the site gives the fallback", () => {
  for (const bad of ["https://evil.com", "http://evil.com/x", "//evil.com", "///evil.com", "/\\evil.com", "/\\/evil.com", "\\\\evil.com", "javascript:alert(1)", "/ok\nHost: evil.com", "/ok\r\nx"]) {
    assert.equal(safeRedirectPath(bad), "/dashboard", JSON.stringify(bad));
  }
});

check("the fallback can be chosen", () => {
  assert.equal(safeRedirectPath("//evil.com", "/login"), "/login");
});

check("every value the browser would treat as another site also fails the URL test", () => {
  const base = "https://gv-hr.vercel.app";
  for (const v of ["/leave", "/reports?x=1", "/a/b/c"]) assert.equal(new URL(safeRedirectPath(v), base).origin, base);
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com"]) assert.equal(new URL(safeRedirectPath(bad), base).origin, base, bad);
});

console.log(`\n${n} checks passed`);
