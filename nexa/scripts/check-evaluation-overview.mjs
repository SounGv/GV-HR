// Checks the numbers behind the evaluation section of the home page.
// Run: node --experimental-strip-types scripts/check-evaluation-overview.mjs
import assert from "node:assert/strict";
import { compareAverages, isDone, summarizeResults, summarizeRound, waitingText } from "../src/features/dashboard-people/evaluation-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const a = (raterType, status) => ({ raterType, status });
const person = (id, department, assignments) => ({ employeeId: id, name: `คน ${id}`, department, assignments });

check("a person is done only when every rater has submitted; no rater at all is not done", () => {
  assert.equal(isDone(person("1", "ขาย", [a("SELF", "SUBMITTED"), a("MANAGER", "SUBMITTED")])), true);
  assert.equal(isDone(person("1", "ขาย", [a("SELF", "SUBMITTED"), a("MANAGER", "IN_PROGRESS")])), false);
  assert.equal(isDone(person("1", "ขาย", [])), false);
});
check("who a person is still waiting on reads in plain words, with a count for groups", () => {
  assert.equal(waitingText([a("SELF", "SUBMITTED"), a("MANAGER", "PENDING"), a("PEER", "PENDING"), a("PEER", "IN_PROGRESS"), a("PEER", "SUBMITTED")]), "หัวหน้า, เพื่อนร่วมงาน 2 คน");
  assert.equal(waitingText([a("SELF", "SUBMITTED")]), "");
});
const round = [
  person("1", "ขาย", [a("SELF", "SUBMITTED"), a("MANAGER", "SUBMITTED")]),
  person("2", "ขาย", [a("SELF", "SUBMITTED"), a("MANAGER", "PENDING")]),
  person("3", "คลัง", [a("SELF", "PENDING"), a("MANAGER", "PENDING"), a("PEER", "IN_PROGRESS")]),
  person("4", "คลัง", []),
];
check("people and forms are counted separately and add up", () => {
  const s = summarizeRound(round);
  assert.deepEqual(s.people, { total: 4, done: 1, pending: 3 });
  assert.equal(s.forms.total, 7);
  assert.equal(s.forms.submitted, 3);
  assert.equal(s.forms.inProgress, 1);
  assert.equal(s.forms.notStarted, 3);
  assert.equal(s.forms.submitted + s.forms.inProgress + s.forms.notStarted, s.forms.total);
  assert.equal(s.forms.percentSubmitted, 43);
});
check("pending is split by rater and by department, worst department first", () => {
  const s = summarizeRound(round);
  assert.deepEqual(s.byRater.map((r) => [r.label, r.pending, r.total]), [["ตนเอง", 1, 3], ["หัวหน้า", 2, 3], ["เพื่อนร่วมงาน", 1, 1]]);
  assert.deepEqual(s.byDepartment.map((d) => [d.department, d.pending, d.total]), [["คลัง", 2, 2], ["ขาย", 1, 2]]);
});
check("the waiting list puts the people with most forms outstanding first and says who is late", () => {
  const s = summarizeRound(round, 2);
  assert.equal(s.pendingPeople.length, 2);
  assert.equal(s.pendingPeople[0].employeeId, "3");
  assert.equal(s.pendingPeople[0].waiting, "ตนเอง, หัวหน้า, เพื่อนร่วมงาน");
  assert.equal(s.pendingPeople[1].waiting, "หัวหน้า");
  assert.equal(summarizeRound(round).pendingPeople.at(-1).waiting, "ยังไม่มีผู้ประเมิน");
});
check("an empty round has zeros, not NaN", () => {
  const s = summarizeRound([]);
  assert.deepEqual(s.people, { total: 0, done: 0, pending: 0 });
  assert.equal(s.forms.percentSubmitted, 0);
});

const rows = [
  { employeeId: "a", name: "ก", department: "บัญชี", scorePercent: 95.24, grade: "A" },
  { employeeId: "b", name: "ข", department: "ขาย", scorePercent: 90, grade: "A" },
  { employeeId: "c", name: "ค", department: "ขาย", scorePercent: 90, grade: "A" },
  { employeeId: "d", name: "ง", department: "คลัง", scorePercent: 71.5, grade: "B" },
  { employeeId: "e", name: "จ", department: "คลัง", scorePercent: 50, grade: null },
];
check("average, grade spread in HR's band order, department averages", () => {
  const r = summarizeResults(rows, ["A", "B", "C"]);
  assert.equal(r.count, 5);
  assert.equal(r.average, 79.3);
  assert.deepEqual(r.grades, [{ label: "A", count: 3 }, { label: "B", count: 1 }]);
  assert.deepEqual(r.departments.map((d) => [d.department, d.average]), [["บัญชี", 95.2], ["ขาย", 90], ["คลัง", 60.8]]);
  assert.deepEqual(summarizeResults(rows, ["B", "A"]).grades.map((g) => g.label), ["B", "A"]);
});
check("ranking shares a rank for equal scores and skips the next one, and stops at N", () => {
  const r = summarizeResults(rows, ["A"], 4);
  assert.deepEqual(r.top.map((t) => [t.rank, t.name]), [[1, "ก"], [2, "ข"], [2, "ค"], [4, "ง"]]);
  assert.equal(summarizeResults(rows, [], 2).top.length, 2);
});
check("no results means null, never a zero average", () => {
  assert.equal(summarizeResults([], []), null);
});

check("the change since the last round says up, down or same, with one decimal", () => {
  assert.deepEqual(compareAverages(82.4, 80.6), { delta: 1.8, direction: "up" });
  assert.deepEqual(compareAverages(78, 80.5), { delta: -2.5, direction: "down" });
  assert.deepEqual(compareAverages(80, 80), { delta: 0, direction: "same" });
  assert.equal(compareAverages(80.02, 80).direction, "same");
});

console.log(`\n${n} checks passed`);
