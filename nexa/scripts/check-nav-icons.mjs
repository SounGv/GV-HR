// Checks the menu icons shown in front of side-menu entries (config/nav-icon-art.ts).
// Run: node --experimental-strip-types scripts/check-nav-icons.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_ICON_ART, NAV_ICON_BY_HREF, navIconArt } from "../src/config/nav-icon-art.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

// Every entry of the side menu except the AI shortcut (it has its own card) and log out, read from the menu file itself.
// Comment lines are dropped first: the payroll entry is written there as a note, not as a menu entry.
const NL = String.fromCharCode(10);
const nav = readFileSync(new URL("../src/config/navigation.ts", import.meta.url), "utf8")
  .split(NL)
  .filter((line) => !line.trim().startsWith("//"))
  .join(NL);
const entries = [...nav.matchAll(/label: "([^"]+)",\s*href: "([^"]+)"([^}]*)\}/g)]
  .map(([, label, href, rest]) => ({ label, href, featured: /featured: true/.test(rest) }))
  .filter((e) => !e.featured);

check("every side-menu entry has an icon", () => {
  assert.equal(entries.length, 43, "the menu has 43 entries besides the AI shortcut");
  const missing = entries.filter((e) => !NAV_ICON_BY_HREF[e.href]).map((e) => e.label);
  assert.deepEqual(missing, []);
});
check("no icon is listed for an entry the menu does not have, and no two entries share an icon", () => {
  const hrefs = new Set(entries.map((e) => e.href));
  assert.deepEqual(Object.keys(NAV_ICON_BY_HREF).filter((h) => !hrefs.has(h)), []);
  const keys = Object.values(NAV_ICON_BY_HREF);
  assert.equal(new Set(keys).size, keys.length, "one icon per meaning");
  assert.equal(Object.keys(NAV_ICON_ART).length, keys.length, "no art left unused");
});
check("the art is plain SVG shapes with the known class names only (it is written into the page as markup)", () => {
  for (const [key, art] of Object.entries(NAV_ICON_ART)) {
    const tags = [...art.matchAll(/<\/?([a-zA-Z]+)/g)].map((m) => m[1]);
    assert.ok(tags.length > 0, `${key} is empty`);
    assert.ok(tags.every((t) => ["path", "circle", "rect", "ellipse"].includes(t)), `${key} uses a tag that is not a basic shape`);
    assert.doesNotMatch(art, /\son\w+=|<script|javascript:|href=/i, `${key} carries something that could run`);
    const classes = [...art.matchAll(/class="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(classes.every((c) => ["mass", "detail", "fine", "solid", "shadow"].includes(c)), `${key} has an unknown class`);
    assert.ok(classes.some((c) => c === "mass" || c === "detail"), `${key} draws nothing visible at 16px`);
    assert.equal((art.match(/</g) ?? []).length, (art.match(/>/g) ?? []).length, `${key} has unbalanced brackets`);
  }
});
check("an href the set does not know gets no icon", () => {
  assert.equal(navIconArt("/not-a-page"), null);
  assert.ok(navIconArt("/dashboard"));
});

console.log(`\n${n} checks passed`);
