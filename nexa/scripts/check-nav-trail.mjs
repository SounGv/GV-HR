// Checks the mobile back-arrow trail: back returns to where you came from and never bounces between two pages.
// Run: node --experimental-strip-types scripts/check-nav-trail.mjs
import assert from "node:assert/strict";
import { MAX_TRAIL, arrive, previousOf } from "../src/components/mobile/nav-trail.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const walk = (...hrefs) => hrefs.reduce((t, h) => arrive(t, h), []);

check("from home into the leave form, back goes home", () => {
  assert.equal(previousOf(walk("/dashboard", "/leave/new")), "/dashboard");
});
check("from the services page into the leave form, back goes to services", () => {
  assert.equal(previousOf(walk("/dashboard", "/services", "/leave/new")), "/services");
});
check("going back cuts the trail, so the next back keeps going back", () => {
  const t = walk("/dashboard", "/services", "/leave/new", "/services");
  assert.deepEqual(t, ["/dashboard", "/services"]);
  assert.equal(previousOf(t), "/dashboard");
});
check("list → detail → list never bounces back to the detail", () => {
  const t = walk("/dashboard", "/leave", "/leave/abc", "/leave");
  assert.equal(previousOf(t), "/dashboard");
});
check("a page opened first has nowhere to go back to (the fixed parent is used)", () => {
  assert.equal(previousOf(walk("/leave/new")), null);
});
check("the same page with a different query counts as a different page", () => {
  assert.equal(previousOf(walk("/reports?view=a", "/reports?view=b")), "/reports?view=a");
});
check("the trail keeps only the most recent pages", () => {
  const t = walk(...Array.from({ length: MAX_TRAIL + 10 }, (_, i) => `/p${i}`));
  assert.equal(t.length, MAX_TRAIL);
  assert.equal(t[t.length - 1], `/p${MAX_TRAIL + 9}`);
});

console.log(`\n${n} checks passed`);
