/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { loadEvaluationOverview } from "@/features/dashboard-people/evaluation-overview";
import { executeReadTool } from "@/lib/ai/read-tools";

// The evaluation section of the home page, against the real database but inside ONE transaction that is thrown
// away at the end: rounds, people and results are made up here and never kept.
const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
class Rollback extends Error {}

const results: { name: string; ok: boolean; err?: string }[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e: any) {
    results.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 5).join(" | ") });
  }
}
const claims = (perms: string[], employeeId?: string) => ({ sub: USER, companyId: COMPANY, email: null, username: null, roles: [], perms, employeeId });
let USER = "";
const snapshot = async () => ({
  rounds: await real.appraisalRound.count(),
  participants: await real.appraisalParticipant.count(),
  assignments: await real.appraisalAssignment.count(),
  employees: await real.employee.count(),
});

(async () => {
  USER = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const form = (await real.appraisalForm.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!;
  const people = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, take: 5, orderBy: { employeeCode: "asc" }, select: { id: true } });
  assert.equal(people.length, 5);
  const [A, B, C, D, E] = people.map((p) => p.id) as [string, string, string, string, string];
  const before = await snapshot();

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        // A manages B and C; D and E report to nobody we care about.
        await tx.employee.update({ where: { id: A }, data: { managerId: null } });
        await tx.employee.update({ where: { id: B }, data: { managerId: A } });
        await tx.employee.update({ where: { id: C }, data: { managerId: A } });
        await tx.employee.update({ where: { id: D }, data: { managerId: null } });

        const in5 = new Date(Date.now() + 5 * 86_400_000);
        const open = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบ เปิดอยู่", formId: form.id, status: "OPEN", endDate: in5, openedAt: new Date() } });
        const mk = async (roundId: string, employeeId: string, department: string, extra: Record<string, unknown> = {}) =>
          tx.appraisalParticipant.create({ data: { roundId, employeeId, departmentName: department, ...extra } });
        const asg = (participantId: string, raterEmployeeId: string, raterType: "SELF" | "MANAGER" | "PEER", status: "PENDING" | "IN_PROGRESS" | "SUBMITTED") =>
          tx.appraisalAssignment.create({ data: { participantId, raterEmployeeId, raterType, status } });
        const pB = await mk(open.id, B, "ขาย");
        const pC = await mk(open.id, C, "ขาย");
        const pD = await mk(open.id, D, "คลัง");
        await asg(pB.id, B, "SELF", "SUBMITTED");
        await asg(pB.id, A, "MANAGER", "PENDING");
        await asg(pC.id, C, "SELF", "SUBMITTED");
        await asg(pC.id, A, "MANAGER", "SUBMITTED");
        await asg(pD.id, D, "SELF", "PENDING");
        await asg(pD.id, E, "MANAGER", "PENDING");

        const closed = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบ ปิดแล้ว", formId: form.id, status: "CLOSED", closedAt: new Date(Date.now() + 3600_000) } });
        await mk(closed.id, B, "ขาย", { resultStatus: "APPROVED", scorePercent: 90, grade: "A" });
        await mk(closed.id, C, "ขาย", { resultStatus: "PUBLISHED", scorePercent: 90, grade: "A" });
        await mk(closed.id, D, "คลัง", { resultStatus: "APPROVED", scorePercent: 70, grade: "B" });
        await mk(closed.id, E, "คลัง", { resultStatus: "CALCULATED", scorePercent: 50, grade: "C" });

        const older = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบ ก่อนหน้า", formId: form.id, status: "CLOSED", closedAt: new Date(Date.now() - 2 * 86_400_000) } });
        await mk(older.id, B, "ขาย", { resultStatus: "APPROVED", scorePercent: 80, grade: "B" });
        await mk(older.id, C, "ขาย", { resultStatus: "APPROVED", scorePercent: 80, grade: "B" });

        const stale = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบ ยังไม่คำนวณ", formId: form.id, status: "CLOSED", closedAt: new Date(Date.now() - 86_400_000) } });
        await mk(stale.id, B, "ขาย");

        const HR = ["campaign:update", "campaign:approve", "campaign:manage"];

        await t("E1 HR sees the whole company: who is waiting, forms, days left, by rater and department", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(HR));
          assert.equal(o.companyWide, true);
          const r = o.open.find((x) => x.id === open.id)!;
          assert.ok(r, "the open round is listed");
          assert.deepEqual(r.summary.people, { total: 3, done: 1, pending: 2 });
          assert.equal(r.summary.forms.total, 6);
          assert.equal(r.summary.forms.submitted, 3);
          assert.equal(r.summary.forms.percentSubmitted, 50);
          assert.ok(r.daysLeft !== null && r.daysLeft >= 4 && r.daysLeft <= 5, `daysLeft ${r.daysLeft}`);
          assert.equal(r.summary.byDepartment.find((d) => d.department === "คลัง")!.pending, 1);
          assert.equal(r.summary.pendingPeople[0]!.waiting, "ตนเอง, หัวหน้า", "the person with most forms outstanding is first");
          assert.equal(r.href, `/appraisal/rounds/${open.id}`);
        });

        await t("E2 a manager sees only the people under them, and their own forms to fill in", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(["campaign:manage"], A));
          assert.equal(o.companyWide, false);
          const r = o.open.find((x) => x.id === open.id)!;
          assert.deepEqual(r.summary.people, { total: 2, done: 1, pending: 1 }, "D is not on their team");
          assert.equal(r.summary.pendingPeople.every((p) => p.employeeId !== D), true);
          const mine = o.myTasks.filter((x) => x.roundId === open.id);
          assert.deepEqual(mine.map((x) => x.status).sort(), ["PENDING", "SUBMITTED"]);
          assert.equal(o.awaitingCalculation, null, "only HR is nudged to calculate");
          assert.equal(o.draftCount, 0);
        });

        await t("E3 a manager with no team sees nothing, not the company", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(["campaign:manage"], D));
          assert.equal(o.open.find((x) => x.id === open.id)!.summary.people.total, 0);
          assert.equal(o.results, null);
          const none = await loadEvaluationOverview(COMPANY, claims(["campaign:manage"]));
          assert.equal(none.open.find((x) => x.id === open.id)!.summary.people.total, 0, "no employee record means no team");
        });

        await t("E4 results: only approved ones count; HR with approve sees the ranking, ties share a rank", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(HR));
          const res = o.results!;
          assert.equal(res.roundId, closed.id);
          assert.equal(res.count, 3, "the CALCULATED result is not shown");
          assert.equal(res.missing, 1);
          assert.equal(res.average, 83.3);
          assert.deepEqual(res.grades, [{ label: "A", count: 2 }, { label: "B", count: 1 }]);
          assert.equal(res.showRanking, true);
          assert.deepEqual(res.top.map((x) => x.rank), [1, 1, 3]);
          assert.deepEqual(res.change, { delta: 3.3, direction: "up", previousName: "รอบทดสอบ ก่อนหน้า" }, "83.3 now against 80 before");
        });

        await t("E5 a manager gets their team's average but never a ranking or other teams", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(["campaign:manage"], A));
          const res = o.results!;
          assert.equal(res.count, 2);
          assert.equal(res.average, 90);
          assert.equal(res.showRanking, false);
          assert.equal(res.change?.delta, 10, "the team's own average against the team's own average before");
          assert.deepEqual(res.top, []);
        });

        await t("E6 HR is told about a closed round nobody calculated", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(HR));
          assert.equal(o.awaitingCalculation?.id, stale.id);
          assert.ok(o.draftCount >= 0);
        });

        await t("E7 with no open rounds and no results the section is empty, with no error", async () => {
          await tx.appraisalRound.updateMany({ where: { companyId: COMPANY }, data: { deletedAt: new Date() } });
          const o = await loadEvaluationOverview(COMPANY, claims(HR));
          assert.deepEqual([o.open.length, o.results, o.awaitingCalculation], [0, null, null]);
          assert.equal(o.myTasks.length, 0);
          await tx.appraisalRound.updateMany({ where: { companyId: COMPANY, id: { in: [open.id, closed.id, stale.id] } }, data: { deletedAt: null } });
        });

        await t("E8 the AI tool and quick action read the same rounds, and never beyond the assistant's own scope", async () => {
          const all = JSON.parse((await executeReadTool(claims(HR), "get_evaluation_progress", {}, undefined))!);
          const row = all.find((x: any) => x.name === "รอบทดสอบ เปิดอยู่");
          assert.ok(row);
          assert.equal(row.participants, 3);
          assert.equal(row.peopleWaiting, 2);
          assert.equal(row.evaluationsTotal, 6);
          // HR whose assistant is limited to two people sees only those two
          const narrow = JSON.parse((await executeReadTool(claims(HR), "get_evaluation_progress", {}, { id: { in: [B, C] } }))!);
          assert.equal(narrow.find((x: any) => x.name === "รอบทดสอบ เปิดอยู่").participants, 2);
          // without the right the tool refuses
          assert.match((await executeReadTool(claims(["leave:read"]), "get_evaluation_progress", {}, undefined))!, /ไม่ได้รับอนุญาต/);
        });

        await t("E9 asking for closed rounds shows them too, marked closed", async () => {
          const only = JSON.parse((await executeReadTool(claims(HR), "get_evaluation_progress", {}, undefined))!);
          assert.equal(only.some((x: any) => x.status === "ปิดแล้ว"), false, "closed rounds only when asked");
          const all = JSON.parse((await executeReadTool(claims(HR), "get_evaluation_progress", { includeClosed: true }, undefined))!);
          const closedRow = all.find((x: any) => x.name === "รอบทดสอบ ปิดแล้ว");
          assert.ok(closedRow, "the closed round is listed");
          assert.equal(closedRow.status, "ปิดแล้ว");
          assert.ok(all.some((x: any) => x.name === "รอบทดสอบ เปิดอยู่" && x.status === "เปิดอยู่"));
        });

        await t("E10 HR who is also someone's manager still gets their own forms to fill in", async () => {
          const o = await loadEvaluationOverview(COMPANY, claims(HR, A));
          assert.equal(o.companyWide, true);
          assert.deepEqual(o.myTasks.filter((x) => x.roundId === open.id).map((x) => x.status).sort(), ["PENDING", "SUBMITTED"]);
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; after the rollback the database is exactly as before: ${clean}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
