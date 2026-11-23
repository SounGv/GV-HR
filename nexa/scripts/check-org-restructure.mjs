// Pure checks for the Gadget Villa org-restructure plan (no DB).
// Run: node --experimental-strip-types scripts/check-org-restructure.mjs
import assert from "node:assert/strict";
import {
  PEOPLE_ALIASES,
  descendantsOf,
  headsInScope,
  matchesAlias,
  planOrgRestructure,
} from "../src/features/organization/org-restructure.ts";

let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

const person = (id, nickname, departmentId, managerId = null, extras = {}) => ({
  id,
  firstName: extras.firstName ?? id,
  lastName: extras.lastName ?? "",
  nickname,
  departmentId,
  managerId,
  positionTitle: extras.positionTitle ?? null,
});

const dept = (id, name, code, parentId = null) => ({ id, name, code, parentId });

check("matchesAlias hits nickname and ignores case/space", () => {
  assert.equal(matchesAlias(person("1", "โน้ต", null), PEOPLE_ALIASES.note), true);
  assert.equal(matchesAlias(person("1", "Elisa", null), PEOPLE_ALIASES.lisha), true);
  assert.equal(matchesAlias(person("1", "เบียร์", null), PEOPLE_ALIASES.beer), true);
  assert.equal(matchesAlias(person("1", "พล", null), PEOPLE_ALIASES.ob), false);
});

check("พี่โอ๊บ is ธนวัตร มัณฑนานนท์ (โอ๊ป) and not โอ๊ต", () => {
  const oap = person("1", "โอ๊ป", null, null, { firstName: "ธนวัตร", lastName: "มัณฑนานนท์" });
  assert.equal(matchesAlias(oap, PEOPLE_ALIASES.ob), true);
  const byName = person("2", null, null, null, { firstName: "ธนวัตร", lastName: "มัณฑนานนท์" });
  assert.equal(matchesAlias(byName, PEOPLE_ALIASES.ob), true);
  assert.equal(matchesAlias(person("3", "โอ๊ต", null), PEOPLE_ALIASES.ob), false);
});

check("descendantsOf walks the reporting tree", () => {
  const people = [
    person("ting", "เติ้ง", "sales"),
    person("h1", "หัว1", "sales", "ting"),
    person("h2", "หัว2", "sales", "ting"),
    person("e1", "ลูก", "sales", "h1"),
  ];
  assert.deepEqual(
    descendantsOf("ting", people)
      .map((p) => p.id)
      .sort(),
    ["e1", "h1", "h2"],
  );
});

check("headsInScope are people in scope who have reports", () => {
  const people = [
    person("ting", "เติ้ง", "sales"),
    person("h1", "หัว1", "sales", "ting"),
    person("e1", "ลูก", "sales", "h1"),
    person("leaf", "ใบ", "sales", "ting"),
  ];
  const under = descendantsOf("ting", people);
  assert.deepEqual(
    headsInScope(under, people).map((p) => p.id),
    ["h1"],
  );
});

check("plan splits transport, moves Ob/Mai, sets Note as approver", () => {
  const depts = [
    dept("log", "ฝ่ายคลังสินค้าและขนส่ง", "LOG"),
    dept("tr", "แผนกขนส่ง", "TR", "log"),
    dept("wh", "แผนกคลังสินค้า", "WH", "log"),
    dept("svc", "ฝ่ายเซอร์วิสและเคลม", "SVC"),
    dept("clm", "แผนกเคลม", "CLM", "svc"),
    dept("pur", "ฝ่ายจัดซื้อต่างประเทศ", "PUR"),
    dept("acc", "ฝ่ายบัญชีและการเงิน", "ACC"),
  ];
  const people = [
    person("beer", "เบียร์", "log"),
    person("ob", "โอ๊ต", "clm"),
    person("mai", "ใหม่", "acc"),
    person("note", "โน้ต", "acc"),
    person("ting", "เติ้ง", "sales"),
    person("th1", "หัวเติ้ง", "sales", "ting", { positionTitle: "ผู้จัดการ" }),
    person("te1", "ลูกเติ้ง", "sales", "th1"),
    person("lisha", "Elisa", "pur"),
    person("lp1", "ลูกลิช่า", "pur", "lisha", { positionTitle: "ผจก.ฝ่าย" }),
    person("jao", "เจาเด้ง", "exec"),
    person("claim1", "เคลม1", "clm", "ob"),
  ];

  const plan = planOrgRestructure(people, depts);
  assert.equal(plan.unresolved.length, 0, plan.unresolved.join("; "));

  const detach = plan.deptChanges.find((c) => c.kind === "detach");
  assert.ok(detach);
  assert.equal(detach.id, "tr");
  assert.equal(detach.name, "ฝ่ายขนส่ง");

  const rename = plan.deptChanges.find((c) => c.kind === "rename");
  assert.ok(rename);
  assert.equal(rename.name, "ฝ่ายคลังสินค้า");

  const create = plan.deptChanges.find((c) => c.kind === "create");
  assert.ok(create);
  assert.equal(create.code, "DATA-ENG");

  const obMove = plan.personMoves.find((m) => m.employeeId === "ob");
  assert.equal(obMove.departmentId, "__CREATE_DATA_ENG__");

  const maiMove = plan.personMoves.find((m) => m.employeeId === "mai");
  assert.equal(maiMove.departmentId, "clm");

  const claimReassign = plan.personMoves.find((m) => m.employeeId === "claim1");
  assert.equal(claimReassign.managerId, "mai");

  const jaoMove = plan.personMoves.find((m) => m.employeeId === "jao");
  assert.equal(jaoMove.managerId, "note");

  const th1Move = plan.personMoves.find((m) => m.employeeId === "th1");
  assert.equal(th1Move.managerId, "note");

  const lp1Move = plan.personMoves.find((m) => m.employeeId === "lp1");
  assert.equal(lp1Move.managerId, "note");
});

check("ambiguous nickname is unresolved (no silent pick)", () => {
  const plan = planOrgRestructure(
    [person("a", "ใหม่", "acc"), person("b", "ใหม่", "acc2"), person("note", "โน้ต", "acc")],
    [dept("acc", "แผนกบัญชี", "ACC"), dept("clm", "แผนกเคลม", "CLM")],
  );
  assert.ok(plan.unresolved.some((u) => /พี่ใหม่/.test(u)));
});

console.log(`\n${n} checks passed`);
