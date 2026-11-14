// Checks that the short photo address built from (length, last 12 characters) equals the one built from the whole value.
// Run: node --experimental-strip-types scripts/check-avatar-paths.mjs
import assert from "node:assert/strict";
import { avatarPathFromParts, avatarSrc } from "../src/lib/avatar.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const ID = "11111111-2222-4333-8444-555555555555";

check("the address built from parts matches avatarSrc for photos of many sizes and endings", () => {
  for (const len of [30, 31, 1000, 204800, 999999]) {
    for (const end of ["AAAA==", "x/y+z0123456789", "short"]) {
      const stored = "data:image/jpeg;base64," + "A".repeat(len) + end;
      assert.equal(avatarPathFromParts(ID, stored.length, stored.slice(-12)), avatarSrc(ID, stored));
    }
  }
});
check("a changed photo gets a different address, an identical one the same", () => {
  const a = "data:image/png;base64," + "A".repeat(500) + "abcdefghijkl";
  const b = "data:image/png;base64," + "A".repeat(500) + "abcdefghijkm";
  assert.notEqual(avatarSrc(ID, a), avatarSrc(ID, b));
  assert.equal(avatarSrc(ID, a), avatarSrc(ID, a));
});
check("a normal link or nothing is returned unchanged", () => {
  assert.equal(avatarSrc(ID, "https://example.com/p.jpg"), "https://example.com/p.jpg");
  assert.equal(avatarSrc(ID, null), null);
  assert.equal(avatarSrc(ID, ""), "");
});
check("the address points at the employee's photo route and keeps only letters and digits in the version", () => {
  const p = avatarPathFromParts(ID, 36, "ab/+=cd-ef_gh");
  assert.equal(p, `/api/employees/${ID}/avatar?v=10abcdefgh`);
});

console.log(`\n${n} checks passed`);
