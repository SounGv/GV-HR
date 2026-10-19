// Checks the sidebar-layout rules (order, hide, pin, clean-up of saved data) with a made-up menu.
// Run: node --experimental-strip-types scripts/check-menu-prefs.mjs
import assert from "node:assert/strict";
import {
  EMPTY_MENU_PREFS,
  MAX_MENU_PREF_ENTRIES,
  isDefaultMenuPrefs,
  isHidden,
  moveId,
  orderByIds,
  orderMenu,
  pinnedItems,
  sanitizeMenuPrefs,
  toggleId,
} from "../src/features/menu-prefs/rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const menu = [
  { label: "A", items: [{ href: "/a1" }, { href: "/a2" }, { href: "/a3" }] },
  { label: "B", items: [{ href: "/b1" }, { href: "/b2" }] },
  { label: "C", items: [{ href: "/c1" }, { href: "/logout", isLogout: true }] },
];
const names = (groups) => groups.map((g) => g.label).join("");
const hrefs = (group) => group.items.map((i) => i.href).join(",");

check("with nothing saved the menu keeps its default order", () => {
  const out = orderMenu(menu, EMPTY_MENU_PREFS);
  assert.equal(names(out), "ABC");
  assert.equal(hrefs(out[0]), "/a1,/a2,/a3");
});
check("groups follow the saved order, and a group not mentioned keeps its place after the rest", () => {
  assert.equal(names(orderMenu(menu, { ...EMPTY_MENU_PREFS, groupOrder: ["C", "A"] })), "CAB");
});
check("items follow the saved order inside their group only", () => {
  const out = orderMenu(menu, { ...EMPTY_MENU_PREFS, itemOrder: { A: ["/a3", "/a1"] } });
  assert.equal(hrefs(out[0]), "/a3,/a1,/a2");
  assert.equal(hrefs(out[1]), "/b1,/b2");
});
check("the sign-out row stays last even when the saved order names it or puts it first", () => {
  const out = orderMenu(menu, { ...EMPTY_MENU_PREFS, itemOrder: { C: ["/logout", "/c1"] } });
  assert.equal(hrefs(out[2]), "/c1,/logout");
});
check("a menu item added later shows at the end of its group, and removed ones in the saved order are ignored", () => {
  const out = orderMenu(menu, { ...EMPTY_MENU_PREFS, itemOrder: { A: ["/gone", "/a2"] } });
  assert.equal(hrefs(out[0]), "/a2,/a1,/a3");
});
check("ordering does not change the default menu it was given", () => {
  const before = JSON.stringify(menu);
  orderMenu(menu, { ...EMPTY_MENU_PREFS, groupOrder: ["C"], itemOrder: { A: ["/a3"] } });
  assert.equal(JSON.stringify(menu), before);
});
check("orderByIds ignores duplicates in the saved list", () => {
  assert.deepEqual(orderByIds([1, 2, 3], String, ["2", "2", "1"]), [2, 1, 3]);
});
check("hidden items are reported hidden and the others are not", () => {
  const prefs = { ...EMPTY_MENU_PREFS, hidden: ["/a2"] };
  assert.equal(isHidden(prefs, "/a2"), true);
  assert.equal(isHidden(prefs, "/a1"), false);
});
check("favourites keep the pin order and skip items the person may not see", () => {
  const prefs = { ...EMPTY_MENU_PREFS, pinned: ["/b2", "/a1", "/c1"] };
  const out = pinnedItems(menu, prefs, (item) => item.href !== "/c1");
  assert.deepEqual(out.map((i) => i.href), ["/b2", "/a1"]);
});
check("the sign-out row can never be a favourite", () => {
  assert.deepEqual(pinnedItems(menu, { ...EMPTY_MENU_PREFS, pinned: ["/logout"] }, () => true), []);
});
check("moving up or down shifts one place and stops at the ends", () => {
  assert.deepEqual(moveId(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveId(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.deepEqual(moveId(["a", "b", "c"], "a", -1), ["a", "b", "c"]);
  assert.deepEqual(moveId(["a", "b", "c"], "c", 1), ["a", "b", "c"]);
  assert.deepEqual(moveId(["a", "b"], "zzz", 1), ["a", "b"]);
});
check("toggling adds an id the first time and removes it the second", () => {
  assert.deepEqual(toggleId([], "x"), ["x"]);
  assert.deepEqual(toggleId(["x", "y"], "x"), ["y"]);
});
check("clean-up keeps real ids and drops unknown ones, duplicates and the sign-out row", () => {
  const out = sanitizeMenuPrefs(
    { groupOrder: ["B", "B", "nope"], itemOrder: { A: ["/a2", "/b1", "/a2"], C: ["/logout", "/c1"], Z: ["/a1"] }, hidden: ["/a1", "/a1", "/logout", "/x"], pinned: ["/b2", 5, null] },
    menu,
  );
  assert.deepEqual(out.groupOrder, ["B"]);
  assert.deepEqual(out.itemOrder, { A: ["/a2"], C: ["/c1"] });
  assert.deepEqual(out.hidden, ["/a1"]);
  assert.deepEqual(out.pinned, ["/b2"]);
});
check("clean-up turns anything that is not an object into the default layout", () => {
  for (const bad of [null, undefined, "x", 42, [], true]) {
    const out = sanitizeMenuPrefs(bad, menu);
    assert.deepEqual(out, { groupOrder: [], itemOrder: {}, hidden: [], pinned: [] });
  }
});
check("clean-up copes with wrong shapes inside an object", () => {
  const out = sanitizeMenuPrefs({ groupOrder: "A", itemOrder: [1], hidden: { a: 1 }, pinned: 7 }, menu);
  assert.deepEqual(out, { groupOrder: [], itemOrder: {}, hidden: [], pinned: [] });
});
check("clean-up caps a list at the stored maximum", () => {
  const big = { label: "Big", items: Array.from({ length: 300 }, (_, i) => ({ href: `/p${i}` })) };
  const out = sanitizeMenuPrefs({ hidden: big.items.map((i) => i.href) }, [big]);
  assert.equal(out.hidden.length, MAX_MENU_PREF_ENTRIES);
});
check("a layout that changes nothing counts as the default menu", () => {
  assert.equal(isDefaultMenuPrefs(EMPTY_MENU_PREFS), true);
  assert.equal(isDefaultMenuPrefs({ ...EMPTY_MENU_PREFS, itemOrder: { A: [] } }), true);
  assert.equal(isDefaultMenuPrefs({ ...EMPTY_MENU_PREFS, hidden: ["/a1"] }), false);
  assert.equal(isDefaultMenuPrefs({ ...EMPTY_MENU_PREFS, itemOrder: { A: ["/a2"] } }), false);
  assert.equal(isDefaultMenuPrefs({ ...EMPTY_MENU_PREFS, groupOrder: ["B"] }), false);
  assert.equal(isDefaultMenuPrefs({ ...EMPTY_MENU_PREFS, pinned: ["/a1"] }), false);
});
check("a cleaned layout can be applied straight away", () => {
  const prefs = sanitizeMenuPrefs({ groupOrder: ["C", "B", "A"], itemOrder: { A: ["/a3", "/a2", "/a1"] } }, menu);
  const out = orderMenu(menu, prefs);
  assert.equal(names(out), "CBA");
  assert.equal(hrefs(out[2]), "/a3,/a2,/a1");
});

console.log(`\n${n} checks passed`);
