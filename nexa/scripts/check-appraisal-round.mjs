// Checks the pure rules of appraisal rounds (matching, readiness, invitations) with made-up people only.
// Run: node --experimental-strip-types scripts/check-appraisal-round.mjs
import assert from "node:assert/strict";
import {
  MAX_LOAD,
  PEER_LIMIT,
  PRESETS,
  matchRaters,
  perspectiveTotal,
  planInvitations,
  roundChecks,
  sendMode,
  shouldRemind,
} from "../src/features/appraisal-round/rules.ts";
import { cleanAnswers, unansweredRequired, visibleQuestions } from "../src/features/appraisal-round/answers.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};
const p = (id, managerId = null, active = true) => ({ id, managerId, active });
// boss ← a, b, c, d (a team of four) ; c has two reports x, y
const roster = [p("boss"), p("a", "boss"), p("b", "boss"), p("c", "boss"), p("d", "boss"), p("x", "c"), p("y", "c")];
const has = (res, pid, rid, type) => res.matches.some((m) => m.participantId === pid && m.raterId === rid && m.raterType === type);

check("presets add one perspective at a time", () => {
  assert.deepEqual(PRESETS["90"], ["MANAGER"]);
  assert.equal(PRESETS["360"].length, 4);
});
check("manager and self are matched from the reporting line", () => {
  const r = matchRaters(["a"], roster, ["MANAGER", "SELF"]);
  assert.ok(has(r, "a", "boss", "MANAGER"));
  assert.ok(has(r, "a", "a", "SELF"));
  assert.deepEqual(r.exceptions, []);
});
check("peers are the other people under the same manager", () => {
  const r = matchRaters(["a"], roster, ["PEER"]);
  assert.deepEqual(r.matches.map((m) => m.raterId).sort(), ["b", "c", "d"]);
});
check("peers are capped", () => {
  const big = [p("m"), ...Array.from({ length: PEER_LIMIT + 4 }, (_, i) => p(`e${i}`, "m"))];
  assert.equal(matchRaters(["e0"], big, ["PEER"]).matches.length, PEER_LIMIT);
});
check("subordinates rate their own manager", () => {
  const r = matchRaters(["c"], roster, ["SUBORDINATE"]);
  assert.deepEqual(r.matches.map((m) => m.raterId).sort(), ["x", "y"]);
});
check("someone with no manager is flagged", () => {
  const r = matchRaters(["boss"], roster, ["MANAGER"]);
  assert.ok(r.exceptions.some((e) => e.kind === "NO_MANAGER" && e.employeeId === "boss"));
  assert.ok(r.exceptions.some((e) => e.kind === "NO_RATER" && e.employeeId === "boss"));
});
check("an inactive manager does not count", () => {
  const r = matchRaters(["a"], [p("boss", null, false), p("a", "boss")], ["MANAGER"]);
  assert.ok(r.exceptions.some((e) => e.kind === "NO_MANAGER"));
});
check("a person with no subordinates is not an error when others rate them", () => {
  const r = matchRaters(["a"], roster, ["MANAGER", "SUBORDINATE"]);
  assert.deepEqual(r.exceptions, []);
});
check("a rater with too many people is flagged", () => {
  const crowd = [p("m"), ...Array.from({ length: MAX_LOAD + 2 }, (_, i) => p(`e${i}`, "m"))];
  const r = matchRaters(crowd.slice(1).map((e) => e.id), crowd, ["MANAGER"]);
  assert.ok(r.exceptions.some((e) => e.kind === "OVERLOADED" && e.employeeId === "m" && e.detail === MAX_LOAD + 2));
});
check("the same pairing is never created twice", () => {
  const r = matchRaters(["a", "a"], roster, ["MANAGER"]);
  assert.equal(r.matches.length, 1);
});

check("perspective weights must total 100 over the selected types", () => {
  assert.deepEqual(perspectiveTotal(["MANAGER", "SELF"], { MANAGER: 70, SELF: 30, PEER: 50 }), { total: 100, ok: true });
  assert.equal(perspectiveTotal(["MANAGER", "SELF"], { MANAGER: 70 }).ok, false);
  assert.equal(perspectiveTotal([], {}).ok, false);
});

const ready = { formPublished: true, participantCount: 3, raterTypes: ["MANAGER"], weights: { MANAGER: 100 }, withoutRater: 0, startIso: "2030-01-01", endIso: "2030-01-07" };
check("a complete round passes every check", () => {
  assert.ok(roundChecks(ready).every((c) => c.ok));
});
check("each missing piece fails its own check with a reason", () => {
  const fail = (patch) => roundChecks({ ...ready, ...patch }).filter((c) => !c.ok);
  assert.equal(fail({ formPublished: false })[0].key, "form");
  assert.equal(fail({ participantCount: 0 })[0].key, "people");
  assert.equal(fail({ weights: { MANAGER: 60 } })[0].key, "raters");
  assert.match(fail({ withoutRater: 2 })[0].why, /2 คน/);
  assert.equal(fail({ startIso: null })[0].key, "schedule");
  assert.match(fail({ endIso: "2029-12-31" })[0].why, /ก่อนวันเปิด/);
});

check("invitations start now when the start day has come, otherwise wait", () => {
  assert.equal(sendMode("2030-01-01", "2030-01-01"), "NOW");
  assert.equal(sendMode("2029-12-01", "2030-01-01"), "NOW");
  assert.equal(sendMode("2030-01-02", "2030-01-01"), "SCHEDULED");
});
check("each rater is messaged once however many people they rate", () => {
  const matches = [
    { participantId: "a", raterId: "boss", raterType: "MANAGER" },
    { participantId: "b", raterId: "boss", raterType: "MANAGER" },
    { participantId: "a", raterId: "a", raterType: "SELF" },
    { participantId: "b", raterId: "ghost", raterType: "PEER" },
  ];
  const plan = planInvitations(matches, new Set(["boss"]), new Set(["boss", "a"]));
  assert.equal(plan.lines.find((l) => l.raterId === "boss").count, 2);
  assert.deepEqual({ total: plan.total, withLine: plan.withLine, appOnly: plan.appOnly, unreachable: plan.unreachable }, { total: 2, withLine: 1, appOnly: 1, unreachable: 1 });
});
check("reminders go out only in the last 2 days and never after the round ends", () => {
  assert.equal(shouldRemind("2030-01-10", "2030-01-07"), false);
  assert.equal(shouldRemind("2030-01-10", "2030-01-08"), true);
  assert.equal(shouldRemind("2030-01-10", "2030-01-10"), true);
  assert.equal(shouldRemind("2030-01-10", "2030-01-11"), false);
});

const Q = [
  { id: "r", text: "คะแนน", helpText: null, answerType: "RATING", options: null, weight: 1, required: true, visibleTo: [] },
  { id: "c", text: "เลือก", helpText: null, answerType: "CHOICE", options: [{ value: "a", label: "ก" }, { value: "b", label: "ข" }], weight: 0, required: true, visibleTo: ["MANAGER"] },
  { id: "m", text: "หลายข้อ", helpText: null, answerType: "MULTI_CHOICE", options: [{ value: "a", label: "ก" }, { value: "b", label: "ข" }], weight: 0, required: false, visibleTo: [] },
  { id: "t", text: "ย่อหน้า", helpText: null, answerType: "PARAGRAPH", options: null, weight: 0, required: false, visibleTo: [] },
];
check("a rater only sees the questions meant for their type", () => {
  assert.deepEqual(visibleQuestions(Q, "MANAGER").map((q) => q.id), ["r", "c", "m", "t"]);
  assert.deepEqual(visibleQuestions(Q, "SELF").map((q) => q.id), ["r", "m", "t"]);
});
check("answers are checked against the question: scale range, listed options, unknown ids", () => {
  const bad = cleanAnswers(Q, "MANAGER", [{ questionId: "r", value: 6 }, { questionId: "c", value: "z" }, { questionId: "ghost", value: 1 }], 5);
  assert.deepEqual(bad, []);
  const good = cleanAnswers(
    Q,
    "MANAGER",
    [{ questionId: "r", value: "4" }, { questionId: "c", value: "b" }, { questionId: "m", value: ["a", "a", "x"] }, { questionId: "t", value: "  สรุป  " }],
    5,
  );
  assert.deepEqual(good, [
    { questionId: "r", value: 4 },
    { questionId: "c", value: "b" },
    { questionId: "m", value: ["a"] },
    { questionId: "t", value: "สรุป" },
  ]);
});
check("a question the rater does not see cannot be answered", () => {
  assert.deepEqual(cleanAnswers(Q, "SELF", [{ questionId: "c", value: "a" }], 5), []);
});
check("required questions block submitting; optional ones do not", () => {
  assert.deepEqual(unansweredRequired(Q, "MANAGER", []), ["ข้อ 1", "ข้อ 2"]);
  assert.deepEqual(unansweredRequired(Q, "SELF", [{ questionId: "r", value: 3 }]), []);
});

console.log(`\n${n} checks passed`);
