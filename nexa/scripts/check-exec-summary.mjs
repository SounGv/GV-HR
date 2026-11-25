// Checks the pure rules of the executive summary of the detailed evaluation report (made-up data only).
// Run: node --experimental-strip-types scripts/check-exec-summary.mjs
import assert from "node:assert/strict";
import { bandOf, bestMovers, execHeadline, execTeams, resolveDepartment, teamNeedsLook, watchPeople } from "../src/features/appraisal-round/exec-summary-rules.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

check("bands: 90 and up is good, 80 to 89.9 is ok, below 80 is watch", () => {
  assert.equal(bandOf(100), "good");
  assert.equal(bandOf(90), "good");
  assert.equal(bandOf(89.9), "ok");
  assert.equal(bandOf(80), "ok");
  assert.equal(bandOf(79.9), "watch");
});

check("teams: those under 3 people get no score and go to the small list", () => {
  const { shown, small } = execTeams([
    { department: "A", count: 5, avg: 92, delta: 1 },
    { department: "B", count: 2, avg: 40, delta: -50 },
    { department: "C", count: 3, avg: 85, delta: 0 },
  ]);
  assert.deepEqual(shown.map((t) => t.department), ["C", "A"]);
  assert.deepEqual(small.map((t) => t.department), ["B"]);
});

check("teams: below 80 first, then ok, then good; within a tone the biggest drop first", () => {
  const { shown } = execTeams([
    { department: "good", count: 4, avg: 95, delta: 2 },
    { department: "ok-flat", count: 4, avg: 85, delta: 0 },
    { department: "ok-drop", count: 4, avg: 84, delta: -6 },
    { department: "watch", count: 4, avg: 70, delta: -1 },
  ]);
  assert.deepEqual(shown.map((t) => t.department), ["watch", "ok-drop", "ok-flat", "good"]);
});

check("teams: a drop of 5 or more is flagged, a smaller one or no earlier round is not", () => {
  const { shown } = execTeams([
    { department: "drop5", count: 3, avg: 86, delta: -5 },
    { department: "drop4", count: 3, avg: 86, delta: -4.9 },
    { department: "new", count: 3, avg: 86, delta: null },
  ]);
  const flag = Object.fromEntries(shown.map((t) => [t.department, t.bigDrop]));
  assert.deepEqual(flag, { drop5: true, drop4: false, new: false });
});

check("teams: needs a look when below 80 or a big drop", () => {
  const [a, b, c] = execTeams([
    { department: "a", count: 3, avg: 79, delta: 0 },
    { department: "b", count: 3, avg: 88, delta: -5 },
    { department: "c", count: 3, avg: 88, delta: -1 },
  ]).shown;
  const byName = Object.fromEntries([a, b, c].map((t) => [t.department, teamNeedsLook(t)]));
  assert.deepEqual(byName, { a: true, b: true, c: false });
});

check("people to talk to: below 80, or down 10 or more; lowest first", () => {
  const list = watchPeople([
    { participantId: "1", total: 95, delta: -10 },
    { participantId: "2", total: 79.9, delta: 3 },
    { participantId: "3", total: 90, delta: -9.9 },
    { participantId: "4", total: 60, delta: null },
  ]);
  assert.deepEqual(list.map((p) => p.participantId), ["4", "2", "1"]);
});

check("best movers: only real rises, biggest first, at most the limit", () => {
  const list = bestMovers(
    [
      { participantId: "1", total: 90, delta: 4 },
      { participantId: "2", total: 80, delta: 0 },
      { participantId: "3", total: 70, delta: -3 },
      { participantId: "4", total: 100, delta: 13 },
      { participantId: "5", total: 95, delta: null },
      { participantId: "6", total: 88, delta: 4 },
      { participantId: "7", total: 60, delta: 1 },
    ],
    3,
  );
  assert.deepEqual(list.map((p) => p.participantId), ["4", "1", "6"]);
});

check("headline: numbers come from the chosen round and the one before it", () => {
  const h = execHeadline(
    [
      { total: 100, prev: 90 },
      { total: 70, prev: 85 },
      { total: 85, prev: null },
    ],
    { submitted: 53, total: 55 },
    [80, 86.5, 83.3],
  );
  assert.equal(h.avg, 83.3);
  assert.equal(h.prevAvg, 86.5);
  assert.equal(h.delta, -3.2);
  assert.equal(h.submittedPct, 96);
  assert.equal(h.low, 1);
  assert.equal(h.lowBefore, 0);
  assert.equal(h.full, 1);
  assert.equal(h.fullPct, 33);
});

check("headline: a first round has no earlier average, and nobody with an earlier score gives no earlier low count", () => {
  const h = execHeadline([{ total: 90, prev: null }], { submitted: 0, total: 0 }, [90]);
  assert.equal(h.prevAvg, null);
  assert.equal(h.delta, null);
  assert.equal(h.lowBefore, null);
  assert.equal(h.submittedPct, 0);
});

check("department: a stored name that is still live stays; a gone one becomes the current department", () => {
  const live = new Set(["แผนกคลังสินค้า", "แผนกเคลม"]);
  assert.equal(resolveDepartment("แผนกเคลม", live, "ฝ่าย IT"), "แผนกเคลม");
  assert.equal(resolveDepartment("แผนกคลังสินค้า Online", live, "แผนกคลังสินค้า"), "แผนกคลังสินค้า");
  assert.equal(resolveDepartment("แผนกคลังสินค้า Offline", live, null), "แผนกคลังสินค้า Offline");
  assert.equal(resolveDepartment(null, live, "แผนกเคลม"), "แผนกเคลม");
  assert.equal(resolveDepartment(null, live, null), "ไม่ระบุแผนก");
});

console.log(`\n${n} checks passed`);
