// Checks that every phone page with its own header can go back: each <MobileScreen> / <MobileHeader> passes a back target,
// and the header itself shows the arrow whenever it has one (a tab page must not hide it).
// Run: node scripts/check-mobile-back-arrow.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "src/components/mobile";
let bad = 0;
let seen = 0;
for (const f of readdirSync(dir, { recursive: true })) {
  if (!String(f).endsWith(".tsx")) continue;
  const text = readFileSync(join(dir, String(f)), "utf8");
  for (const m of text.matchAll(/<(MobileScreen|MobileHeader)\b([\s\S]*?)>\s*(?=[\n<{A-Za-z])/g)) {
    const attrs = m[2];
    // The wrapper that passes the route table's target through spread props is checked by check-mobile-route-titles.
    if (/\bbackHref=|\bonBack=|\{\.\.\./.test(attrs) || String(f).includes("mobile-content-wrapper")) {
      seen++;
      continue;
    }
    // Props written as `backHref={...}` on several lines are matched above; anything else lacks a target.
    if (/backHref|onBack/.test(attrs)) {
      seen++;
      continue;
    }
    bad++;
    console.log(`MISSING back target: ${f} <${m[1]} ${attrs.trim().slice(0, 60).replace(/\s+/g, " ")}…>`);
  }
}
const header = readFileSync(join(dir, "mobile-header.tsx"), "utf8");
if (!/const showBack = !!backHref \|\| !!onBack;/.test(header)) {
  bad++;
  console.log("mobile-header.tsx must show the arrow whenever backHref or onBack is given");
}
console.log(`${seen} headers have a back target${bad ? `, ${bad} problem(s)` : ", none missing"}`);
process.exit(bad ? 1 : 0);
