// Checks the Thai date box: ISO ↔ day/month/Buddhist year, and that the native
// date control stays tappable (iPhone ignores showPicker on a pointer-events-none overlay).
// Run: node --experimental-strip-types scripts/check-date-input.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isoToThaiText, maskDate, thaiTextToIso } from "../src/components/ui/date-text.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("ISO dates become day/month/Buddhist year", () => {
  assert.equal(isoToThaiText("2026-11-20"), "20/11/2569");
  assert.equal(isoToThaiText("2026-01-05"), "05/01/2569");
  assert.equal(isoToThaiText(""), "");
  assert.equal(isoToThaiText("not-a-date"), "");
});
check("typed Buddhist or Western dates become ISO", () => {
  assert.equal(thaiTextToIso("20/11/2569"), "2026-11-20");
  assert.equal(thaiTextToIso("20/11/2026"), "2026-11-20");
  assert.equal(thaiTextToIso("05/01/2569"), "2026-01-05");
  assert.equal(thaiTextToIso("31/02/2569"), null);
  assert.equal(thaiTextToIso("20/11"), null);
});
check("digits are masked as day/month/year while typing", () => {
  assert.equal(maskDate("20112569"), "20/11/2569");
  assert.equal(maskDate("20"), "20");
  assert.equal(maskDate("2011"), "20/11");
});
check("the native date input is a tap target, not pointer-events-none", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/components/ui/date-input.tsx"),
    "utf8",
  );
  assert.equal(
    src.includes(".showPicker("),
    false,
    "iPhone Safari ignores showPicker() on a hidden date input",
  );
  assert.match(src, /type="date"/);
  assert.equal(
    src.includes("pointer-events-none absolute inset-0 opacity-0"),
    false,
    "the native date overlay must receive the tap on iPhone",
  );
  assert.match(src, /opacity-\[0\.01\]/);
});

console.log(`\n${n} checks passed`);
