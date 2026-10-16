// Checks that stored photos are swapped for short addresses in API payloads, with made-up data only.
// Run: node --experimental-strip-types scripts/check-avatar-slim.mjs
import assert from "node:assert/strict";
import { avatarSrc, isAvatarPath, slimAvatars } from "../src/lib/avatar.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const ID = "11111111-2222-3333-4444-555555555555";
const photo = "data:image/jpeg;base64," + "A".repeat(3000);

check("a stored photo becomes a short address with the employee id", () => {
  const out = avatarSrc(ID, photo);
  assert.match(out, new RegExp(`^/api/employees/${ID}/avatar\\?v=`));
  assert.ok(out.length < 100);
  assert.equal(isAvatarPath(out), true);
});
check("a normal link, an empty value and null are left alone", () => {
  assert.equal(avatarSrc(ID, "https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(avatarSrc(ID, null), null);
  assert.equal(avatarSrc(ID, ""), "");
});
check("a different photo gets a different version", () => {
  assert.notEqual(avatarSrc(ID, photo), avatarSrc(ID, photo + "BBBB"));
});
check("lists, nested employees and other fields are handled", () => {
  const payload = [{ id: "r1", employee: { id: ID, firstName: "ตัวอย่าง", avatarUrl: photo } }, { id: "r2", employee: { id: ID, avatarUrl: null } }];
  const out = slimAvatars(payload);
  assert.equal(out[0].id, "r1");
  assert.equal(out[0].employee.firstName, "ตัวอย่าง");
  assert.ok(out[0].employee.avatarUrl.startsWith(`/api/employees/${ID}/avatar`));
  assert.equal(out[1].employee.avatarUrl, null);
  assert.equal(payload[0].employee.avatarUrl, photo, "the original is not changed");
});
check("an object without an id keeps its photo (nothing to point to)", () => {
  assert.equal(slimAvatars({ avatarUrl: photo }).avatarUrl, photo);
});
check("dates and numbers pass through unchanged", () => {
  const d = new Date("2030-03-04T00:00:00Z");
  const out = slimAvatars({ id: "x", when: d, count: 3 });
  assert.equal(out.when, d);
  assert.equal(out.count, 3);
});
check("only the exact short address counts as one (a form sends it back as 'unchanged')", () => {
  assert.equal(isAvatarPath(`/api/employees/${ID}/avatar?v=abc`), true);
  assert.equal(isAvatarPath(`/api/employees/${ID}/avatar`), true);
  assert.equal(isAvatarPath("/api/employees/not-an-id/avatar"), false);
  assert.equal(isAvatarPath(photo), false);
});

console.log(`\n${n} checks passed`);
