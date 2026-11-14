/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { applyPendingMigration } from "./pending-migration.mts";
import { adjustScore, revertAdjustment } from "@/features/appraisal-round/adjust-service";
import { calculateRound, listMyResults } from "@/features/appraisal-round/results-service";
import { getRoundReview } from "@/features/appraisal-round/review-service";

// Adjusting a calculated score by hand, against the real database but inside ONE transaction that is thrown away at the end.
// The new table and columns do not exist in the live database yet, so the migration file is run INSIDE the transaction first
// (Postgres can undo DDL): the test proves the migration SQL and the code agree, and nothing is kept.
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
const claims = (perms: string[], employeeId?: string, username: string | null = "hr.test") => ({ sub: USER, companyId: COMPANY, email: null, username, roles: [], perms, employeeId });
const snapshot = async () => ({
  rounds: await real.appraisalRound.count(),
  participants: await real.appraisalParticipant.count(),
  assignments: await real.appraisalAssignment.count(),
  employees: await real.employee.count(),
  settings: await real.appraisalSettings.count(),
  audit: await real.auditLog.count(),
});
const refused = (msg: RegExp) => (e: unknown) => msg.test(String((e as Error)?.message));

(async () => {
  USER = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const form = (await real.appraisalForm.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!;
  const people = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, take: 6, orderBy: { employeeCode: "asc" }, select: { id: true } });
  assert.equal(people.length, 6);
  const [E1, E2, E3, E4, E5] = people.map((p) => p.id) as [string, string, string, string, string];
  const tableCount = async () =>
    Number((await real.$queryRawUnsafe<{ n: bigint }[]>("select count(*)::bigint as n from information_schema.tables where table_name = 'appraisal_score_adjustments'"))[0]!.n);
  const tableBefore = await tableCount();
  const before = await snapshot();

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        // The migration exactly as it would be applied (skipped once the live database already has it), then the test runs against the result.
        const applied = await applyPendingMigration(tx);
        assert.equal(applied, tableBefore === 0, "the migration runs here only while the live database lacks it");

        const bands = [{ label: "เยี่ยม", minPercent: 90 }, { label: "ดี", minPercent: 75 }, { label: "พอใช้", minPercent: 60 }, { label: "ต้องปรับปรุง", minPercent: 0 }];
        await tx.appraisalSettings.upsert({ where: { companyId: COMPANY }, update: { calcMode: "SIMPLE", bands, employeeSees: "AFTER_PUBLISH" }, create: { companyId: COMPANY, calcMode: "SIMPLE", bands, employeeSees: "AFTER_PUBLISH" } });

        const q = (id: string) => ({ id, text: id, helpText: null, answerType: "RATING", options: null, weight: 1, required: true, visibleTo: [] as string[] });
        const snap = { defaultFormId: form.id, forms: { [form.id]: { id: form.id, name: "ทดสอบ", version: 1, ratingMax: 5, questions: [q("q1"), q("q2")] } } };
        const round = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบปรับคะแนน", formId: form.id, status: "CLOSED", closedAt: new Date(), formSnapshot: snap as any } });
        const mk = (roundId: string, employeeId: string, status: any, score: number | null, grade: string | null, extra: Record<string, unknown> = {}) =>
          tx.appraisalParticipant.create({ data: { roundId, employeeId, departmentName: "ขาย", resultStatus: status, scorePercent: score, overallScore: score === null ? null : score / 20, grade, ...extra } });
        const p1 = await mk(round.id, E1, "CALCULATED", 75.9, "ดี");
        const p2 = await mk(round.id, E2, "APPROVED", 80, "ดี");
        const p3 = await mk(round.id, E3, "NOT_CALCULATED", null, null);
        const p4 = await mk(round.id, E4, "CALCULATED", 66, "พอใช้");
        const why = "หัวหน้าให้คะแนนต่ำกว่าผลงานจริงที่มีหลักฐาน";
        const HR = ["campaign:update", "campaign:approve", "campaign:manage"];
        const row = (id: string) => tx.appraisalParticipant.findUniqueOrThrow({ where: { id } });
        const history = (id: string) => tx.appraisalScoreAdjustment.findMany({ where: { participantId: id }, orderBy: { createdAt: "asc" } });

        await t("A1 the migration SQL runs, and a change inside 5 points is stored with its grade, original and history", async () => {
          const auditBefore = await tx.auditLog.count();
          const r = await adjustScore(COMPANY, claims(HR), round.id, p1.id, { scorePercent: 74, reason: why });
          assert.deepEqual(r, { scorePercent: 74, grade: "พอใช้" });
          const p = await row(p1.id);
          assert.equal(p.scorePercent, 74);
          assert.equal(p.grade, "พอใช้");
          assert.equal(p.overallScore, 3.7, "the score on the form's own scale follows the percentage (74% of 5)");
          assert.equal(p.originalScorePercent, 75.9);
          assert.equal(p.originalGrade, "ดี");
          assert.ok(p.adjustedAt);
          assert.equal(p.resultStatus, "CALCULATED", "still waiting for approval");
          const h = await history(p1.id);
          assert.equal(h.length, 1);
          assert.deepEqual([h[0]!.kind, h[0]!.fromPercent, h[0]!.toPercent, h[0]!.fromGrade, h[0]!.toGrade, h[0]!.reason, h[0]!.byName], ["ADJUST", 75.9, 74, "ดี", "พอใช้", why, "hr.test"]);
          assert.equal(await tx.auditLog.count(), auditBefore + 1, "one audit row");
        });

        await t("A2 more than 5 points from the calculated score is refused and changes nothing", async () => {
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p1.id, { scorePercent: 81, reason: why }), refused(/ไม่เกิน 5 จุด/));
          assert.equal((await row(p1.id)).scorePercent, 74);
          assert.equal((await history(p1.id)).length, 1);
        });

        await t("A3 a second adjustment is measured from the original, not from the first change", async () => {
          await adjustScore(COMPANY, claims(HR), round.id, p1.id, { scorePercent: 78, reason: why });
          const p = await row(p1.id);
          assert.equal(p.scorePercent, 78);
          assert.equal(p.grade, "ดี");
          assert.equal(p.originalScorePercent, 75.9, "the original is never overwritten by a later adjustment");
          assert.equal(p.originalGrade, "ดี");
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p1.id, { scorePercent: 81.5, reason: why }), refused(/70\.9 ถึง 80\.9/));
          assert.equal((await history(p1.id)).length, 2);
        });

        await t("A4 a short reason, the same score, or a score off the scale is refused", async () => {
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p4.id, { scorePercent: 68, reason: "สั้น" }), refused(/อย่างน้อย 10/));
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p4.id, { scorePercent: 66, reason: why }), refused(/เท่าเดิม/));
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p4.id, { scorePercent: 101, reason: why }), refused(/0 ถึง 100/));
          const p = await row(p4.id);
          assert.equal(p.scorePercent, 66);
          assert.equal(p.adjustedAt, null);
          assert.equal((await history(p4.id)).length, 0);
        });

        await t("A5 an approved or uncalculated result, or a person from another round, cannot be adjusted", async () => {
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p2.id, { scorePercent: 82, reason: why }), refused(/ยังไม่อนุมัติ/));
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), round.id, p3.id, { scorePercent: 82, reason: why }), refused(/ยังไม่อนุมัติ/));
          await assert.rejects(() => adjustScore(COMPANY, claims(HR), "00000000-0000-0000-0000-00000000dead", p4.id, { scorePercent: 68, reason: why }), refused(/ไม่พบ/));
          assert.equal((await row(p2.id)).scorePercent, 80);
        });

        await t("A6 recalculating keeps an adjusted person as they are, and says how many it kept", async () => {
          const r = await calculateRound(COMPANY, claims(HR), round.id);
          assert.equal(r.adjustedKept, 1);
          assert.equal(r.kept, 1, "the approved one");
          const p = await row(p1.id);
          assert.equal(p.scorePercent, 78, "not dropped");
          assert.ok(p.adjustedAt);
          assert.equal((await row(p4.id)).resultStatus, "NOT_CALCULATED", "an unadjusted person with no answers resets as before");
        });

        await t("A7 the review shows who was adjusted with the original, the history newest first, and the adjust right only for HR", async () => {
          const hr = await getRoundReview(COMPANY, claims(HR), round.id);
          assert.equal(hr.canAdjust, true);
          assert.equal(hr.thresholds.maxAdjust, 5);
          const me = hr.people.find((x) => x.participantId === p1.id)!;
          assert.deepEqual([me.adjusted, me.original, me.total], [true, 75.9, 78]);
          assert.equal(hr.adjustments.length, 2);
          assert.deepEqual(hr.adjustments.map((a) => a.toPercent), [78, 74], "newest first");
          assert.equal(hr.adjustments[0]!.byName, "hr.test");
          const approver = await getRoundReview(COMPANY, claims(["campaign:approve"], undefined), round.id);
          assert.equal(approver.canAdjust, false);
        });

        await t("A8 undoing needs a reason, restores the calculated score and grade, and is logged", async () => {
          await assert.rejects(() => revertAdjustment(COMPANY, claims(HR), round.id, p1.id, { reason: "สั้น" }), refused(/อย่างน้อย 10/));
          await assert.rejects(() => revertAdjustment(COMPANY, claims(HR), round.id, p4.id, { reason: why }), refused(/ยังไม่ได้ถูกปรับ|ยังไม่อนุมัติ/));
          const r = await revertAdjustment(COMPANY, claims(HR), round.id, p1.id, { reason: "ตรวจแล้วคะแนนเดิมถูกต้อง ขอยกเลิกการปรับ" });
          assert.deepEqual(r, { scorePercent: 75.9, grade: "ดี" });
          const p = await row(p1.id);
          assert.deepEqual([p.scorePercent, p.grade, p.adjustedAt, p.originalScorePercent, p.originalGrade], [75.9, "ดี", null, null, null]);
          assert.equal(p.overallScore, Math.round((75.9 / 100) * 5 * 100) / 100);
          const h = await history(p1.id);
          assert.equal(h.length, 3);
          assert.deepEqual([h[2]!.kind, h[2]!.fromPercent, h[2]!.toPercent], ["REVERT", 78, 75.9]);
          const again = await calculateRound(COMPANY, claims(HR), round.id);
          assert.equal(again.adjustedKept, 0, "after the undo a recalculation treats the person normally");
        });

        await t("A9 the employee sees the final score and grade only, never the history or the original", async () => {
          const pub = await tx.appraisalRound.create({ data: { companyId: COMPANY, name: "รอบทดสอบประกาศแล้ว", formId: form.id, status: "CLOSED", closedAt: new Date(), formSnapshot: snap as any } });
          await tx.appraisalParticipant.create({
            data: { roundId: pub.id, employeeId: E5, departmentName: "ขาย", resultStatus: "PUBLISHED", scorePercent: 74, overallScore: 3.7, grade: "พอใช้", publishedAt: new Date(), adjustedAt: new Date(), originalScorePercent: 75.9, originalGrade: "ดี" },
          });
          const mine = await listMyResults(COMPANY, claims(["notification:read"], E5));
          const m = mine.find((x) => x.roundName === "รอบทดสอบประกาศแล้ว")!;
          assert.ok(m, "the published result is listed");
          assert.equal(m.scorePercent, 74);
          assert.equal(m.grade, "พอใช้");
          const text = JSON.stringify(m);
          for (const leak of ["adjust", "original", "75.9", "reason", "hr.test"]) assert.equal(text.includes(leak), false, `no "${leak}" in what the employee gets`);
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 180_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  // The migration was only run inside the transaction: the live database must be in the same state as before.
  const noTable = (await tableCount()) === tableBefore;
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; database exactly as before: ${clean}; live table state unchanged: ${noTable}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean && noTable ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
