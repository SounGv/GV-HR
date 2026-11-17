/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getRoundReview } from "@/features/appraisal-round/review-service";
import { applyPendingMigration } from "./pending-migration.mts";

// The review page's numbers, against the real database but inside ONE transaction that is thrown away at the end:
// rounds, people, answers and grade bands are made up here and never kept.
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
let USER = "";
const claims = (perms: string[], employeeId?: string) => ({ sub: USER, companyId: COMPANY, email: null, username: null, roles: [], perms, employeeId });
const snapshot = async () => ({
  rounds: await real.appraisalRound.count(),
  participants: await real.appraisalParticipant.count(),
  assignments: await real.appraisalAssignment.count(),
  employees: await real.employee.count(),
  settings: await real.appraisalSettings.count(),
  audit: await real.auditLog.count(),
});

(async () => {
  USER = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const form = (await real.appraisalForm.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!;
  const people = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, take: 12, orderBy: { employeeCode: "asc" }, select: { id: true } });
  assert.equal(people.length, 12);
  const ids = people.map((p) => p.id);
  const [M1, M2, M3] = ids as [string, string, string];
  const staff = ids.slice(3, 10); // seven people being rated
  const before = await snapshot();

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        await applyPendingMigration(tx);
        // M1 is the line manager of the first three; the rest report to nobody we care about.
        for (const [i, id] of ids.entries()) await tx.employee.update({ where: { id }, data: { managerId: i >= 3 && i <= 5 ? M1 : null } });
        await tx.appraisalSettings.upsert({
          where: { companyId: COMPANY },
          update: { calcMode: "SIMPLE", bands: [{ label: "เยี่ยม", minPercent: 90 }, { label: "ดี", minPercent: 75 }, { label: "พอใช้", minPercent: 60 }, { label: "ต้องปรับปรุง", minPercent: 0 }] },
          create: { companyId: COMPANY, calcMode: "SIMPLE", bands: [{ label: "เยี่ยม", minPercent: 90 }, { label: "ดี", minPercent: 75 }, { label: "พอใช้", minPercent: 60 }, { label: "ต้องปรับปรุง", minPercent: 0 }] },
        });

        const q = (id: string) => ({ id, text: id, helpText: null, answerType: "RATING", options: null, weight: 1, required: true, visibleTo: [] as string[] });
        const snap = { defaultFormId: form.id, forms: { [form.id]: { id: form.id, name: "ทดสอบ", version: 1, ratingMax: 5, questions: [q("q1"), q("q2")] } } };
        const round = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบทบทวน", formId: form.id, status: "CLOSED", closedAt: new Date(), formSnapshot: snap as any } });

        const rate = (v: number) => [{ questionId: "q1", value: v }, { questionId: "q2", value: v }];
        const mk = async (employeeId: string, department: string, total: number | null, self: number | null, mgr: number | null, grade: string | null) => {
          const types = [
            ...(self !== null ? [{ raterType: "SELF", raters: 1, percent: self, weightUsed: 50 }] : []),
            ...(mgr !== null ? [{ raterType: "MANAGER", raters: 1, percent: mgr, weightUsed: 50 }] : []),
          ];
          return tx.appraisalParticipant.create({
            data: {
              roundId: round.id,
              employeeId,
              departmentName: department,
              ...(total === null
                ? {}
                : { resultStatus: "CALCULATED" as const, scorePercent: total, grade, scoreBreakdown: { scorePercent: total, overallScore: total / 20, grade, mode: "SIMPLE", types } as any }),
            },
          });
        };
        const asg = (participantId: string, raterEmployeeId: string, value: number) =>
          tx.appraisalAssignment.create({ data: { participantId, raterEmployeeId, raterType: "MANAGER", status: "SUBMITTED", answers: rate(value) as any } });

        // M1 gave 5 of 5 (100%) to three people, M2 gave 2 of 5 (40%) to three, M3 gave 3.5 average... one person at 70%.
        const p = [
          await mk(staff[0]!, "ขาย", 95, 92, 98, "เยี่ยม"),
          await mk(staff[1]!, "ขาย", 82, 92, 78, "ดี"), // self far above the manager
          await mk(staff[2]!, "คลัง", 74.4, 74, 74.5, "พอใช้"), // a hair under 75
          await mk(staff[3]!, "คลัง", 55, 50, 60, "ต้องปรับปรุง"),
          await mk(staff[4]!, "บัญชี", 66, 66, 66, "พอใช้"),
          await mk(staff[5]!, "บัญชี", 91, 90, 92, "เยี่ยม"),
          await mk(staff[6]!, "บัญชี", null, null, null, null), // not calculated yet, but M3 already answered for them
        ];
        for (const i of [0, 1, 2]) await asg(p[i]!.id, M1, 5);
        for (const i of [3, 4, 5]) await asg(p[i]!.id, M2, 2);
        await tx.appraisalAssignment.create({ data: { participantId: p[6]!.id, raterEmployeeId: M3, raterType: "MANAGER", status: "SUBMITTED", answers: rate(3.5) as any } });
        // A pending answer must not count, and neither must a rating outside the scale.
        await tx.appraisalAssignment.create({ data: { participantId: p[0]!.id, raterEmployeeId: M2, raterType: "MANAGER", status: "PENDING", answers: rate(1) as any } });

        const HR = ["campaign:update", "campaign:approve", "campaign:manage"];
        const counts = async () => ({ p: await tx.appraisalParticipant.count(), a: await tx.appraisalAssignment.count(), s: await tx.appraisalSettings.count() });

        await t("R1 HR sees everyone: seven in the round, six calculated, company-wide", async () => {
          const c0 = await counts();
          const r = await getRoundReview(COMPANY, claims(HR), round.id);
          assert.equal(r.total, 7);
          assert.equal(r.calculated, 6);
          assert.equal(r.companyWide, true);
          assert.equal(r.roundName, "รอบทดสอบทบทวน");
          assert.deepEqual(await counts(), c0, "reading the review writes nothing");
        });

        await t("R2 grade spread follows the saved bands, highest first, and splits by department", async () => {
          const r = await getRoundReview(COMPANY, claims(HR), round.id);
          assert.deepEqual(r.bands, ["เยี่ยม", "ดี", "พอใช้", "ต้องปรับปรุง"]);
          assert.deepEqual(r.spread.counts, [2, 1, 2, 1]); // 95,91 | 82 | 74.4,66 | 55
          assert.equal(r.spread.below, 0);
          const by = Object.fromEntries(r.spread.byDepartment.map((d) => [d.department, d]));
          assert.deepEqual(by["ขาย"]!.counts, [1, 1, 0, 0]);
          assert.deepEqual(by["คลัง"]!.counts, [0, 0, 1, 1]);
          assert.deepEqual(by["บัญชี"]!.counts, [1, 0, 1, 0]);
          assert.equal(by["บัญชี"]!.total, 2, "the uncalculated person is not counted");
        });

        await t("R3 manager averages: 100 vs 40 are flagged, the one-person manager shows no number, the company figure counts everyone", async () => {
          const r = await getRoundReview(COMPANY, claims(HR), round.id);
          const rows = Object.fromEntries(r.managers.rows.map((m) => [m.count + ":" + m.status, m]));
          // company average over the seven given percentages: 300 + 120 + 70 = 490 / 7 = 70
          assert.equal(r.managers.companyAverage, 70);
          assert.equal(rows["3:high"]!.average, 100);
          assert.equal(rows["3:high"]!.diff, 30);
          assert.equal(rows["3:low"]!.average, 40);
          assert.equal(rows["3:low"]!.diff, -30);
          assert.deepEqual([rows["1:few"]!.average, rows["1:few"]!.diff], [null, null]);
          assert.equal(r.managers.rows.at(-1)!.status, "few", "hidden groups last");
          assert.equal(r.managers.rows.length, 3, "the pending answer and the empty manager add no row");
        });

        await t("R4 people with something to look at come first, with the right flags", async () => {
          const r = await getRoundReview(COMPANY, claims(HR), round.id);
          const by = Object.fromEntries(r.people.map((x) => [x.total, x]));
          assert.deepEqual([by[82]!.gap, by[82]!.talk, by[82]!.nearEdge], [14, true, false]);
          assert.deepEqual([by[74.4]!.gap, by[74.4]!.talk, by[74.4]!.nearEdge], [-0.5, false, true]);
          assert.equal(by[95]!.nearEdge, false);
          assert.equal(by[91]!.nearEdge, false);
          assert.equal(r.people.length, 6);
          const flaggedFirst = r.people.slice(0, 2).every((x) => x.talk || x.nearEdge) && r.people.slice(2).every((x) => !x.talk && !x.nearEdge);
          assert.ok(flaggedFirst, "flagged people are listed before the rest");
        });

        await t("R5 an approver who also manages a team sees only that team, and 'company' means those people", async () => {
          const r = await getRoundReview(COMPANY, claims(["campaign:approve", "campaign:manage"], M1), round.id);
          assert.equal(r.companyWide, false);
          assert.equal(r.total, 3, "only the three under M1");
          assert.deepEqual(r.people.map((x) => x.total).sort((a, b) => a - b), [74.4, 82, 95]);
          assert.equal(r.managers.rows.length, 1, "M2's and M3's averages are not shown to someone who cannot see their people");
          assert.equal(r.managers.companyAverage, 100, "the average of the people this viewer can see");
        });

        await t("R6 a person with no team sees only the one person they rate as manager; with no employee record, nobody", async () => {
          const r = await getRoundReview(COMPANY, claims(["campaign:approve"], M3), round.id);
          assert.equal(r.total, 1, "M3 rated p[6] and nobody else in this round");
          assert.deepEqual(r.people, [], "p[6] is not calculated yet, so there is no result to list");
          assert.equal(r.managers.rows.length, 1, "the only manager average shown is M3's own, for the person they rated");
          const none = await getRoundReview(COMPANY, claims(["campaign:approve"]), round.id);
          assert.equal(none.total, 0, "no employee record means no team");
        });

        await t("R7 no grade bands: the spread is empty (the page asks HR to set them) but people and managers still show", async () => {
          await tx.appraisalSettings.update({ where: { companyId: COMPANY }, data: { bands: [] } });
          const r = await getRoundReview(COMPANY, claims(HR), round.id);
          assert.deepEqual(r.bands, []);
          assert.equal(r.people.length, 6);
          assert.equal(r.people.every((x) => x.nearEdge === false), true, "no bands, nothing to be near");
          assert.equal(r.managers.rows.length, 3);
          await tx.appraisalSettings.update({ where: { companyId: COMPANY }, data: { bands: [{ label: "เยี่ยม", minPercent: 90 }, { label: "ดี", minPercent: 75 }] } });
          const two = await getRoundReview(COMPANY, claims(HR), round.id);
          assert.equal(two.spread.below, 3, "55, 66 and 74.4 are under every band that was set");
        });

        await t("R8 a round nobody has calculated has an empty review, not an error", async () => {
          const empty = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบว่าง", formId: form.id, status: "CLOSED", closedAt: new Date() } });
          const r = await getRoundReview(COMPANY, claims(HR), empty.id);
          assert.equal(r.total, 0);
          assert.equal(r.calculated, 0);
          assert.deepEqual(r.people, []);
          assert.equal(r.managers.companyAverage, null);
        });

        await t("R9 a round of another company or a made-up id is not found", async () => {
          await assert.rejects(() => getRoundReview(COMPANY, claims(HR), "00000000-0000-0000-0000-00000000dead"), /ไม่พบรอบประเมิน/);
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
