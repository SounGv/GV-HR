// Checks who a manager may see in appraisal tracking and results, with made-up people only.
// Run: node --experimental-strip-types scripts/check-appraisal-org-scope.mjs
import assert from "node:assert/strict";
import { idsUnder } from "../src/features/appraisal-round/org-scope.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const people = [
  { id: "ceo", managerId: null },
  { id: "head", managerId: "ceo" },
  { id: "lead1", managerId: "head" },
  { id: "lead2", managerId: "head" },
  { id: "a", managerId: "lead1" },
  { id: "b", managerId: "lead1" },
  { id: "c", managerId: "lead2" },
  { id: "other", managerId: "ceo" },
];
const sorted = (s) => [...s].sort();

check("a division head sees every level below them", () => {
  assert.deepEqual(sorted(idsUnder(people, "head")), ["a", "b", "c", "lead1", "lead2"]);
});
check("a team lead sees only their own team", () => {
  assert.deepEqual(sorted(idsUnder(people, "lead1")), ["a", "b"]);
});
check("nobody sees themself or a colleague in another division", () => {
  const s = idsUnder(people, "head");
  assert.ok(!s.has("head") && !s.has("other") && !s.has("ceo"));
});
check("someone with no team sees no one", () => {
  assert.equal(idsUnder(people, "a").size, 0);
});
check("a manager loop in the data does not hang or include the root", () => {
  const loop = [
    { id: "x", managerId: "y" },
    { id: "y", managerId: "x" },
  ];
  assert.deepEqual(sorted(idsUnder(loop, "x")), ["y"]);
});

console.log(`\n${n} checks passed`);
