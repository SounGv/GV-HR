// Checks that every page under src/app/(app) has a title for the phone header (config/mobile-routes.ts),
// so none falls back to the neutral "GV One" title or shows a raw URL word such as "new".
// Run: node --experimental-strip-types scripts/check-mobile-route-titles.mjs
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import { isMobileCustomPath, resolveMobileRoute } from "../src/config/mobile-routes.ts";

// Pages that only redirect elsewhere (the old evaluation screens now go to /appraisal); never shown on a phone.
const REDIRECT_ONLY = new Set(["/performance/templates/new", "/performance/templates/sample-id/edit"]);

const root = fileURLToPath(new URL("../src/app/(app)", import.meta.url));
const routes = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name === "page.tsx") {
      const segments = relative(root, dir)
        .split(sep)
        .filter((s) => s && !(s.startsWith("(") && s.endsWith(")")));
      routes.push("/" + segments.map((s) => (s.startsWith("[") ? "sample-id" : s)).join("/"));
    }
  }
})(root);

const missing = routes.filter(
  (r) => r !== "/" && !isMobileCustomPath(r) && !REDIRECT_ONLY.has(r) && resolveMobileRoute(r).title === "GV One",
);
assert.deepEqual(missing, [], `pages with no phone header title:\n${missing.join("\n")}`);
console.log(`ok  all ${routes.length} pages have a phone header title (or their own mobile layout)`);
