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
  assert.equal(matchesAlias(person("1", "โน๊ต", null), PEOPLE_ALIASES.note), true);
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

check("Ting, Lisha and Beer match their names from the org chart", () => {
  const ting = person("t", "เติ้ง", null, null, { firstName: "วีรวรรณ", lastName: "สุกณาวรรณ" });
  assert.equal(matchesAlias(ting, PEOPLE_ALIASES.ting), true);
  const tingByName = person("t2", null, null, null, { firstName: "วีรวรรณ", lastName: "สุกณาวรรณ" });
  assert.equal(matchesAlias(tingByName, PEOPLE_ALIASES.ting), true);
  const lisha = person("l", "Elisa", null, null, { firstName: "Miss.Ho", lastName: "Yi-Hsuan" });
  assert.equal(matchesAlias(lisha, PEOPLE_ALIASES.lisha), true);
  const beer = person("b", "เบียร์รับเข้า", null, null, { firstName: "วันชัย", lastName: "ไชยหงษ์" });
  assert.equal(matchesAlias(beer, PEOPLE_ALIASES.beer), true);
  const beerByName = person("b2", null, null, null, { firstName: "วันชัย", lastName: "ไชยหงษ์" });
  assert.equal(matchesAlias(beerByName, PEOPLE_ALIASES.beer), true);
});

check("พี่โน๊ต is จุฑามาส เลื่อนศักดิ์, not จักรพงศ์ (โน้ต) of accounting", () => {
  const jutamas = person("j", "โน๊ต", null, null, { firstName: "จุฑามาส", lastName: "เลื่อนศักดิ์" });
  assert.equal(matchesAlias(jutamas, PEOPLE_ALIASES.note), true);
  const byName = person("j2", "โน้ต", null, null, { firstName: "จุฑามาส", lastName: "เลื่อนศักดิ์" });
  assert.equal(matchesAlias(byName, PEOPLE_ALIASES.note), true);
  const chakkraphong = person("c", "โน้ต", null, null, { firstName: "จักรพงศ์", lastName: "เสาหิรัญกุล" });
  assert.equal(matchesAlias(chakkraphong, PEOPLE_ALIASES.note), false);
});

check("พี่ใหม่ is ชัยณรงค์ เลาหโกญจน ใหม่ (บัญชี)", () => {
  const mai = person("m", "ใหม่ (บัญชี)", null, null, { firstName: "ชัยณรงค์", lastName: "เลาหโกญจน" });
  assert.equal(matchesAlias(mai, PEOPLE_ALIASES.mai), true);
  const byName = person("m2", null, null, null, { firstName: "ชัยณรงค์", lastName: "เลาหโกญจน" });
  assert.equal(matchesAlias(byName, PEOPLE_ALIASES.mai), true);
  assert.equal(matchesAlias(person("m3", "ใหม่", null), PEOPLE_ALIASES.mai), false);
});

check("เจา is เมธา ทองหมี (จนท.ฝ่ายขนส่ง)", () => {
  const jao = person("j", "เจา", null, null, { firstName: "เมธา", lastName: "ทองหมี" });
  assert.equal(matchesAlias(jao, PEOPLE_ALIASES.jaoDeng), true);
  const byName = person("j2", null, null, null, { firstName: "เมธา", lastName: "ทองหมี" });
  assert.equal(matchesAlias(byName, PEOPLE_ALIASES.jaoDeng), true);
  assert.equal(matchesAlias(person("j3", "เจนนี่", null), PEOPLE_ALIASES.jaoDeng), false);
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
    person("mai", "ใหม่ (บัญชี)", "acc"),
    person("note", "โน๊ต", "acc"),
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

  assert.equal(
    plan.personMoves.some((m) => m.employeeId === "mai"),
    false,
    "พี่ใหม่ heads accounting and claims, so his department is not moved",
  );

  const claimReassign = plan.personMoves.find((m) => m.employeeId === "claim1");
  assert.equal(claimReassign.managerId, "mai");

  const jaoMove = plan.personMoves.find((m) => m.employeeId === "jao");
  assert.equal(jaoMove.managerId, "note");

  const th1Move = plan.personMoves.find((m) => m.employeeId === "th1");
  assert.equal(th1Move.managerId, "note");

  const lp1Move = plan.personMoves.find((m) => m.employeeId === "lp1");
  assert.equal(lp1Move.managerId, "note");
});

check("warehouse staff move into ฝ่ายคลังสินค้า ออนไลน์/ออฟไลน์ by position, old แผนกคลังสินค้า is deleted", () => {
  const depts = [
    dept("wh", "แผนกคลังสินค้า", "WH"),
    dept("off", "แผนกคลังสินค้า Offline", "ST-OF"),
    dept("on", "แผนกคลังสินค้า Online", "ST-ON"),
    dept("tr", "แผนกขนส่ง", "TR"),
    dept("clm", "แผนกเคลม", "CLM"),
  ];
  const w = (id, title) => ({ ...person(id, id, "wh"), positionTitle: title });
  const plan = planOrgRestructure(
    [person("note", "โน๊ต", null), w("a", "พนักงานคลังสินค้า-ออนไลน์"), w("b", "พนักงานคลังสินค้า-ออฟไลน์")],
    depts,
    [
      { id: "p-on", title: "พนักงานคลังสินค้า-ออนไลน์", departmentId: "wh" },
      { id: "p-off", title: "พนักงานคลังสินค้า-ออฟไลน์", departmentId: "wh" },
    ],
  );
  assert.equal(plan.positionMoves.find((m) => m.id === "p-on")?.departmentId, "on");
  assert.equal(plan.positionMoves.find((m) => m.id === "p-off")?.departmentId, "off");
  const renames = Object.fromEntries(plan.deptChanges.filter((c) => c.kind === "rename").map((c) => [c.id, c.name]));
  assert.equal(renames.on, "ฝ่ายคลังสินค้า ออนไลน์");
  assert.equal(renames.off, "ฝ่ายคลังสินค้า ออฟไลน์");
  assert.equal(plan.personMoves.find((m) => m.employeeId === "a")?.departmentId, "on");
  assert.equal(plan.personMoves.find((m) => m.employeeId === "b")?.departmentId, "off");
  assert.ok(plan.deptChanges.some((c) => c.kind === "delete" && c.id === "wh"));
});

check("warehouse person with unclear position stays, old แผนกคลังสินค้า is kept", () => {
  const depts = [
    dept("wh", "แผนกคลังสินค้า", "WH"),
    dept("off", "แผนกคลังสินค้า Offline", "ST-OF"),
    dept("on", "แผนกคลังสินค้า Online", "ST-ON"),
    dept("tr", "แผนกขนส่ง", "TR"),
    dept("clm", "แผนกเคลม", "CLM"),
  ];
  const plan = planOrgRestructure(
    [person("note", "โน๊ต", null), { ...person("x", "x", "wh"), positionTitle: "หัวหน้าคลัง" }],
    depts,
  );
  assert.equal(plan.personMoves.find((m) => m.employeeId === "x"), undefined);
  assert.ok(!plan.deptChanges.some((c) => c.kind === "delete"));
});

check("ambiguous nickname is unresolved (no silent pick)", () => {
  const plan = planOrgRestructure(
    [person("a", "ใหม่ (บัญชี)", "acc"), person("b", "ใหม่ (บัญชี)", "acc2"), person("note", "โน๊ต", "acc")],
    [dept("acc", "แผนกบัญชี", "ACC"), dept("clm", "แผนกเคลม", "CLM")],
  );
  assert.ok(plan.unresolved.some((u) => /พี่ใหม่/.test(u)));
});

console.log(`\n${n} checks passed`);
