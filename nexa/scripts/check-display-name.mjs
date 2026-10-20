// Checks how a person's name is shown: "first last (nickname)".
// Run: node --experimental-strip-types scripts/check-display-name.mjs
import assert from "node:assert/strict";
import { displayName } from "../src/lib/format.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("a nickname follows the full name in parentheses", () => {
  assert.equal(displayName({ firstName: "สมชาย", lastName: "ใจดี", nickname: "ชาย" }), "สมชาย ใจดี (ชาย)");
});
check("no nickname (null, undefined, empty or blank) leaves just the full name", () => {
  for (const nickname of [null, undefined, "", "   "]) {
    assert.equal(displayName({ firstName: "สมชาย", lastName: "ใจดี", nickname }), "สมชาย ใจดี");
  }
});
check("a missing last name does not leave a stray space", () => {
  assert.equal(displayName({ firstName: "สมชาย", lastName: null, nickname: "ชาย" }), "สมชาย (ชาย)");
});
check("spaces around the nickname are trimmed", () => {
  assert.equal(displayName({ firstName: "A", lastName: "B", nickname: " Bee " }), "A B (Bee)");
});

console.log(`\n${n} checks passed`);
