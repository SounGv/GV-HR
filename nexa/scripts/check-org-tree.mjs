// Checks the pure org chart rules (divisions, ฝ่ายอื่นๆ, heads, leads, data issues) with made-up data only.
// Run: node --experimental-strip-types scripts/check-org-tree.mjs
import assert from "node:assert/strict";
import {
  OTHER_KEY,
  buildCompanyTree,
  buildDivisionPeople,
  detectOrgIssues,
  divisionHead,
  hasOrgIssues,
  looksLikeSameDept,
} from "../src/features/organization/org-tree.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const dept = (id, name, parentId = null) => ({ id, name, code: id.toUpperCase(), parentId });
const person = (id, departmentId, managerId = null) => ({
  id,
  name: id,
  nickname: null,
  departmentId,
  managerId,
  positionTitle: null,
});

// LOG division: root "log" with two departments; "gone" is a deleted parent.
const depts = [
  dept("log", "ฝ่ายคลังสินค้า"),
  dept("wh", "แผนกคลัง", "log"),
  dept("tr", "แผนกขนส่ง", "log"),
  dept("acc", "แผนกบัญชี", "gone"), // parent soft-deleted → root
  dept("exec", "ผู้บริหาร"),
  dept("it", "ฝ่าย IT"),
  dept("buy", "ฝ่ายจัดซื้อ"),
];
const people = [
  person("boss", "log"),
  person("whLead", "wh", "boss"),
  person("w1", "wh", "whLead"),
  person("w2", "wh", "whLead"),
  person("trLead", "tr", "boss"),
  person("t1", "tr", "trLead"),
  person("loner", "tr"), // no manager, nobody under → unassigned
  person("a1", "acc"),
  person("a2", "acc"),
  person("a3", "acc"),
  person("ceo", "exec"),
  person("itGuy", "it", "ceo"),
  person("b1", "buy"),
  person("b2", "buy"),
  person("b3", "buy"),
];

check("a department whose parent was deleted is treated as a root", () => {
  const tree = buildCompanyTree(depts, people);
  const acc = tree.divisions.find((d) => d.key === "acc");
  assert.ok(acc, "แผนกบัญชี (3 people, parent gone) gets its own card");
  assert.equal(acc.headcount, 3);
  assert.equal(acc.departments.length, 0);
});

check("childless roots with ≤2 people go into ฝ่ายอื่นๆ; bigger ones keep their own card", () => {
  const tree = buildCompanyTree(depts, people);
  const other = tree.divisions.at(-1);
  assert.equal(other.key, OTHER_KEY);
  assert.deepEqual(other.departments.map((d) => d.id).sort(), ["exec", "it"]);
  assert.equal(other.headcount, 2);
  assert.ok(tree.divisions.some((d) => d.key === "buy"));
  assert.equal(tree.total, people.length);
});

check("divisions are ordered by headcount with sub-departments and counts", () => {
  const tree = buildCompanyTree(depts, people);
  assert.equal(tree.divisions[0].key, "log");
  assert.equal(tree.divisions[0].headcount, 7);
  assert.equal(tree.divisions[0].rootCount, 1);
  assert.deepEqual(
    tree.divisions[0].departments.map((d) => [d.id, d.count]),
    [["tr", 3], ["wh", 3]],
  );
});

check("the head is the top person with people under them; the loner goes to ยังไม่ระบุหัวหน้า", () => {
  const log = buildCompanyTree(depts, people).divisions[0];
  const view = buildDivisionPeople(log, people);
  assert.deepEqual(view.heads.map((h) => [h.person.id, h.under]), [["boss", 5]]);
  assert.deepEqual(view.unassigned.map((p) => p.id), ["loner"]);
  assert.equal(divisionHead(log, people)?.person.id, "boss");
});

check("each department column gets its lead and the rest as members", () => {
  const log = buildCompanyTree(depts, people).divisions[0];
  const view = buildDivisionPeople(log, people);
  const wh = view.teams.find((t) => t.deptId === "wh");
  assert.equal(wh.lead.person.id, "whLead");
  assert.equal(wh.lead.under, 2);
  assert.deepEqual(wh.members.map((p) => p.id).sort(), ["w1", "w2"]);
  const tr = view.teams.find((t) => t.deptId === "tr");
  assert.equal(tr.count, 3);
  assert.equal(tr.lead.person.id, "trLead");
  assert.deepEqual(tr.members.map((p) => p.id), ["t1"]);
  // The root column held only the head, so it is left out.
  assert.equal(view.teams.some((t) => t.deptId === "log"), false);
  assert.equal(view.leadCount, 2);
});

check("nobody with a manager and nobody under anyone → all of them go to ยังไม่ระบุหัวหน้า", () => {
  const buy = buildCompanyTree(depts, people).divisions.find((d) => d.key === "buy");
  const view = buildDivisionPeople(buy, people);
  assert.equal(view.heads.length, 0);
  assert.deepEqual(view.unassigned.map((p) => p.id), ["b1", "b2", "b3"]);
  assert.equal(view.teams.length, 0);
});

check("department heads reporting to someone outside lead their own column; no division head", () => {
  // Sales: two department heads report to the CEO in another division; one
  // salesperson reports straight to the CEO too and stays in their column.
  const d = [...depts, dept("sales", "ฝ่ายขาย"), dept("on", "แผนกออนไลน์", "sales"), dept("off", "แผนกออฟไลน์", "sales")];
  const p = [
    ...people,
    person("onLead", "on", "ceo"),
    person("on1", "on", "onLead"),
    person("on2", "on", "onLead"),
    person("offLead", "off", "ceo"),
    person("off1", "off", "offLead"),
    person("direct", "off", "ceo"),
  ];
  const sales = buildCompanyTree(d, p).divisions.find((x) => x.key === "sales");
  const view = buildDivisionPeople(sales, p);
  assert.equal(view.heads.length, 0);
  assert.equal(divisionHead(sales, p), null);
  assert.equal(view.unassigned.length, 0);
  const on = view.teams.find((t) => t.deptId === "on");
  const off = view.teams.find((t) => t.deptId === "off");
  assert.equal(on.lead.person.id, "onLead");
  assert.equal(off.lead.person.id, "offLead");
  assert.deepEqual(off.members.map((x) => x.id), ["off1", "direct"]); // direct report of the lead first
  assert.equal(view.leadCount, 2);
});

check("a single top with a team in a sub-department is the division head", () => {
  const d = [dept("div", "ฝ่าย Z"), dept("z1", "แผนก Z1", "div")];
  const p = [person("chief", "z1", "outsider"), person("z1a", "z1", "chief"), person("z1b", "z1", "chief")];
  const div = buildCompanyTree(d, p).divisions[0];
  const view = buildDivisionPeople(div, p);
  assert.deepEqual(view.heads.map((h) => [h.person.id, h.under]), [["chief", 2]]);
  // chief's manager is not an active employee, but chief heads the division so is not "unassigned".
  assert.equal(view.unassigned.length, 0);
  assert.equal(view.teams[0].lead, null);
});

check("ฝ่ายอื่นๆ has no head even when one member reports to another", () => {
  const other = buildCompanyTree(depts, people).divisions.at(-1);
  const view = buildDivisionPeople(other, people);
  assert.equal(view.heads.length, 0);
  assert.equal(view.teams.reduce((s, t) => s + t.members.length + (t.lead ? 1 : 0), 0), 2);
});

check("a managerId loop A → B → A does not hang and is reported", () => {
  const loopPeople = [person("A", "wh", "B"), person("B", "wh", "A"), person("C", "wh", "A")];
  const log = buildCompanyTree(depts, loopPeople).divisions[0];
  const view = buildDivisionPeople(log, loopPeople);
  assert.equal(view.heads.length, 0); // nobody is on top of a loop
  const shown = view.teams.flatMap((t) => [...(t.lead ? [t.lead.person.id] : []), ...t.members.map((p) => p.id)]);
  assert.deepEqual(shown.sort(), ["A", "B", "C"]);
  assert.equal(detectOrgIssues(depts, loopPeople).managerLoop, 2);
});

check("a department parent loop with no root still shows up", () => {
  const loopDepts = [dept("x", "แผนก X", "y"), dept("y", "แผนก Y", "x")];
  const tree = buildCompanyTree(loopDepts, [person("p1", "x"), person("p2", "x"), person("p3", "y")]);
  const ids = tree.divisions.flatMap((d) => d.deptIds);
  assert.deepEqual(ids.sort(), ["x", "y"]);
});

check("likely duplicate names share the prefix and differ only by a 'และ…' tail or spaces", () => {
  assert.equal(looksLikeSameDept("ฝ่ายเซอร์วิส", "ฝ่ายเซอร์วิสและเคลม"), true);
  assert.equal(looksLikeSameDept("ฝ่าย IT", "ฝ่ายIT"), true);
  assert.equal(looksLikeSameDept("แผนกบัญชี", "ฝ่ายบัญชีและการเงิน"), false);
  assert.equal(looksLikeSameDept("แผนกการตลาดออนไลน์", "แผนกการตลาดออฟไลน์"), false);
  assert.equal(looksLikeSameDept("แผนกขาย", "แผนกขายออนไลน์"), false);
});

check("data issues: orphan, duplicate, test dept, no department, no manager", () => {
  const d = [...depts, dept("svc", "ฝ่ายเซอร์วิส"), dept("svc2", "ฝ่ายเซอร์วิสและเคลม"), dept("tst", "Test Dept")];
  const p = [...people, person("x1", null, "boss"), person("x2", "deletedDept", "ghost")];
  const issues = detectOrgIssues(d, p);
  assert.deepEqual(issues.orphanDepts.map((o) => [o.name, o.count]), [["แผนกบัญชี", 3]]);
  assert.deepEqual(issues.duplicateNames, [["ฝ่ายเซอร์วิส", "ฝ่ายเซอร์วิสและเคลม"]]);
  assert.deepEqual(issues.testDepts.map((t) => t.name), ["Test Dept"]);
  assert.equal(issues.noDepartment, 2);
  // boss, loner, a1-a3, ceo, b1-b3 have none; x2's manager is not an active employee.
  assert.equal(issues.noManager, 10);
  assert.equal(issues.managerLoop, 0);
  assert.equal(hasOrgIssues(issues), true);
});

check("clean data has no issues", () => {
  const issues = detectOrgIssues([dept("a", "ฝ่าย A")], []);
  assert.equal(hasOrgIssues(issues), false);
});

console.log(`\n${n} checks passed`);
