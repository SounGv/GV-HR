// Checks hand-set rater pairs: how they sit on top of the org-chart matching, and how a pasted list is read.
// Run: node --experimental-strip-types scripts/check-appraisal-raters.mjs
import assert from "node:assert/strict";
import { MAX_LOAD, addPair, applyRaterOverrides, matchRaters, readOverrides, removePair } from "../src/features/appraisal-round/rules.ts";
import { parsePairLines } from "../src/features/appraisal-round/pair-import.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

// boss -> a, b ; c reports to nobody; d is inactive
const roster = [
  { id: "boss", managerId: null, active: true },
  { id: "a", managerId: "boss", active: true },
  { id: "b", managerId: "boss", active: true },
  { id: "c", managerId: null, active: true },
  { id: "d", managerId: "boss", active: false },
];
const ctx = (types, participantIds) => ({ participantIds, roster, types });
const keys = (r) => r.matches.map((m) => `${m.participantId}<-${m.raterId}:${m.raterType}`).sort();

check("with nothing set by hand the result is the automatic matching, exceptions included", () => {
  const types = ["MANAGER"];
  const ids = ["a", "b", "c"];
  const auto = matchRaters(ids, roster, types);
  const out = applyRaterOverrides(auto, null, ctx(types, ids));
  assert.deepEqual(keys(out), keys(auto));
  assert.deepEqual(out.exceptions.map((e) => [e.kind, e.employeeId]), [["NO_MANAGER", "c"], ["NO_RATER", "c"]]);
  assert.equal(out.ignored, 0);
});

check("a hand-set rater gives someone with no manager a rater, so they are no longer without one", () => {
  const types = ["MANAGER"];
  const ids = ["a", "c"];
  const auto = matchRaters(ids, roster, types);
  const out = applyRaterOverrides(auto, { add: [{ participantId: "c", raterId: "a", raterType: "MANAGER" }], remove: [] }, ctx(types, ids));
  assert.deepEqual(keys(out), ["a<-boss:MANAGER", "c<-a:MANAGER"]);
  assert.deepEqual(out.exceptions, []);
});

check("one person can have several raters of the same type, from any department", () => {
  const types = ["MANAGER"];
  const ids = ["a"];
  const out = applyRaterOverrides(matchRaters(ids, roster, types), { add: [{ participantId: "a", raterId: "c", raterType: "MANAGER" }], remove: [] }, ctx(types, ids));
  assert.deepEqual(keys(out), ["a<-boss:MANAGER", "a<-c:MANAGER"]);
});

check("taking out an automatic pair removes it, and the person is flagged if nobody is left", () => {
  const types = ["MANAGER"];
  const ids = ["a"];
  const out = applyRaterOverrides(matchRaters(ids, roster, types), { add: [], remove: [{ participantId: "a", raterId: "boss", raterType: "MANAGER" }] }, ctx(types, ids));
  assert.deepEqual(out.matches, []);
  assert.deepEqual(out.exceptions.map((e) => e.kind), ["NO_MANAGER", "NO_RATER"]);
});

check("removing wins over adding the same pair, and adding twice counts once", () => {
  const types = ["MANAGER"];
  const ids = ["a"];
  const pair = { participantId: "a", raterId: "c", raterType: "MANAGER" };
  const both = applyRaterOverrides(matchRaters(ids, roster, types), { add: [pair], remove: [pair] }, ctx(types, ids));
  assert.deepEqual(keys(both), ["a<-boss:MANAGER"]);
  const twice = applyRaterOverrides(matchRaters(ids, roster, types), { add: [pair, pair], remove: [] }, ctx(types, ids));
  assert.equal(twice.matches.filter((m) => m.raterId === "c").length, 1);
});

check("pairs that cannot apply are ignored and counted, never half-applied", () => {
  const types = ["MANAGER"];
  const ids = ["a"];
  const bad = [
    { participantId: "b", raterId: "c", raterType: "MANAGER" }, // b is not in the round
    { participantId: "a", raterId: "d", raterType: "MANAGER" }, // d is inactive
    { participantId: "a", raterId: "ghost", raterType: "MANAGER" }, // not an employee
    { participantId: "a", raterId: "c", raterType: "PEER" }, // the round does not use PEER
    { participantId: "a", raterId: "a", raterType: "MANAGER" }, // rating yourself as manager
    { participantId: "a", raterId: "c", raterType: "SELF" }, // SELF for someone else
  ];
  const out = applyRaterOverrides(matchRaters(ids, roster, types), { add: bad, remove: [] }, ctx(types, ids));
  assert.equal(out.ignored, bad.length);
  assert.deepEqual(keys(out), ["a<-boss:MANAGER"]);
});

check("a rater with more than MAX_LOAD people is flagged but still allowed", () => {
  const many = Array.from({ length: MAX_LOAD + 1 }, (_, i) => ({ id: `p${i}`, managerId: null, active: true }));
  const r = [...many, { id: "rater", managerId: null, active: true }];
  const ids = many.map((p) => p.id);
  const add = ids.map((id) => ({ participantId: id, raterId: "rater", raterType: "MANAGER" }));
  const out = applyRaterOverrides({ matches: [], exceptions: [] }, { add, remove: [] }, { participantIds: ids, roster: r, types: ["MANAGER"] });
  assert.equal(out.matches.length, MAX_LOAD + 1);
  assert.deepEqual(out.exceptions.filter((e) => e.kind === "OVERLOADED"), [{ kind: "OVERLOADED", employeeId: "rater", detail: MAX_LOAD + 1 }]);
});

check("stored overrides of any odd shape read as empty instead of breaking the round", () => {
  for (const raw of [null, undefined, 5, "x", [], { add: "no" }, { add: [{ participantId: 1 }], remove: [null] }]) assert.deepEqual(readOverrides(raw), { add: [], remove: [] });
  assert.equal(readOverrides({ add: [{ participantId: "a", raterId: "b", raterType: "PEER" }, { participantId: "a", raterId: "b", raterType: "BOGUS" }] }).add.length, 1);
});

check("adding then removing a hand-set pair leaves nothing; removing an automatic pair then adding it back also leaves nothing", () => {
  const empty = { add: [], remove: [] };
  const m = { participantId: "a", raterId: "c", raterType: "MANAGER" };
  assert.deepEqual(removePair(addPair(empty, m), m), empty);
  assert.deepEqual(addPair(removePair(empty, m), m), empty);
});

check("adding the same pair twice, or removing the same automatic pair twice, is stored once", () => {
  const m = { participantId: "a", raterId: "c", raterType: "MANAGER" };
  const once = addPair({ add: [], remove: [] }, m);
  assert.equal(addPair(once, m).add.length, 1);
  const gone = removePair({ add: [], remove: [] }, m);
  assert.equal(removePair(gone, m).remove.length, 1);
});

const people = [
  { id: "1", name: "สมชาย ใจดี (ชาย)" },
  { id: "2", name: "สมหญิง รักงาน" },
  { id: "3", name: "สมศรี ซ้ำกัน (ศรี)" },
  { id: "4", name: "สมศรี ซ้ำกัน (ศรีสอง)" },
];

check("a pasted list is matched by name, brackets and spaces ignored, type words in Thai or English", () => {
  const r = parsePairLines("สมชาย ใจดี | สมหญิง รักงาน | หัวหน้า\nสมหญิงรักงาน|สมชายใจดี|ลูกน้อง\nสมชาย ใจดี | สมหญิง รักงาน | peer", people, "MANAGER");
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.pairs, [
    { participantId: "2", raterId: "1", raterType: "MANAGER" },
    { participantId: "1", raterId: "2", raterType: "SUBORDINATE" },
    { participantId: "2", raterId: "1", raterType: "PEER" },
  ]);
});

check("a missing type uses the default; tabs work as separators; blank lines are skipped", () => {
  const r = parsePairLines("\nสมชาย ใจดี\tสมหญิง รักงาน\n\n", people, "PEER");
  assert.deepEqual(r.pairs, [{ participantId: "2", raterId: "1", raterType: "PEER" }]);
});

check("every kind of bad line is reported with its line number and none of them becomes a pair", () => {
  const text = [
    "สมชาย ใจดี | สมหญิง รักงาน | หัวหน้า", // 1 ok
    "สมชาย ใจดี", // 2 format
    "ไม่มีคนนี้ | สมหญิง รักงาน", // 3 no rater
    "สมชาย ใจดี | ไม่มีคนนี้", // 4 no ratee
    "สมศรี ซ้ำกัน | สมชาย ใจดี", // 5 ambiguous rater
    "สมชาย ใจดี | สมศรี ซ้ำกัน", // 6 ambiguous ratee
    "สมชาย ใจดี | สมหญิง รักงาน | บอส", // 7 bad type
    "สมชาย ใจดี | สมชาย ใจดี | หัวหน้า", // 8 rating yourself as manager
    "สมชาย ใจดี | สมหญิง รักงาน | SELF", // 9 SELF for someone else
    "สมชาย ใจดี | สมหญิง รักงาน | หัวหน้า", // 10 duplicate of line 1
  ].join("\n");
  const r = parsePairLines(text, people, "MANAGER");
  assert.equal(r.pairs.length, 1);
  assert.deepEqual(r.problems.map((p) => [p.line, p.kind]), [
    [2, "FORMAT"], [3, "NO_RATER"], [4, "NO_RATEE"], [5, "AMBIGUOUS_RATER"], [6, "AMBIGUOUS_RATEE"], [7, "BAD_TYPE"], [8, "BAD_PAIR"], [9, "BAD_PAIR"], [10, "DUPLICATE"],
  ]);
});

console.log(`\n${n} checks passed`);
