// Checks who a manager may see in appraisal tracking and results, with made-up people only.
// Run: node --experimental-strip-types scripts/check-appraisal-org-scope.mjs
import assert from "node:assert/strict";
import { idsUnder, participantScope } from "../src/features/appraisal-round/org-scope.ts";

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

check("HR (no id list) gets no filter at all", () => {
  assert.deepEqual(participantScope(null, "hr"), {});
});
check("a viewer with no employee record gets only the org-chart list", () => {
  assert.deepEqual(participantScope(new Set(["a"]), null), { employeeId: { in: ["a"] } });
  assert.deepEqual(participantScope(new Set(), undefined), { employeeId: { in: [] } });
});
check("a manager also gets the people they rate as manager, in that round only, and never themself", () => {
  const f = participantScope(new Set(["a", "b"]), "m1");
  assert.deepEqual(f, {
    OR: [
      { employeeId: { in: ["a", "b"] } },
      { employeeId: { not: "m1" }, assignments: { some: { raterEmployeeId: "m1", raterType: "MANAGER" } } },
    ],
  });
});
check("a manager with an empty org team still gets the rated people", () => {
  const f = participantScope(new Set(), "m2");
  assert.equal(f.OR.length, 2);
  assert.deepEqual(f.OR[0], { employeeId: { in: [] } });
});
check("the rater branch asks for the MANAGER rater type only (not peer or subordinate)", () => {
  const f = participantScope(new Set(), "m3");
  assert.equal(f.OR[1].assignments.some.raterType, "MANAGER");
});

console.log(`\n${n} checks passed`);
