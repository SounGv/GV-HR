/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { applyPendingRaterPairs } from "./pending-rater-pairs.mts";
import { createForm, publishForm, updateForm } from "@/features/appraisal-form/service";
import { cloneRound, createRound, getRound, openRound, updateRound } from "@/features/appraisal-round/service";

// Hand-set rater pairs, against the real database but inside ONE transaction that is thrown away at the end: the round, the form
// and the manager links made here are never kept. The column is added inside the transaction when the live database lacks it.
for (const k of Object.keys(process.env)) if (k.startsWith("LINE_") || k.startsWith("RESEND") || k.startsWith("SMTP")) delete process.env[k];
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
const snapshot = async () => ({
  rounds: await real.appraisalRound.count(),
  forms: await real.appraisalForm.count(),
  participants: await real.appraisalParticipant.count(),
  assignments: await real.appraisalAssignment.count(),
  notifications: await real.notification.count(),
  employees: await real.employee.count(),
});

(async () => {
  const USER = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const hr = { sub: USER, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["campaign:update", "campaign:approve", "campaign:manage", "campaign:create"] };
  const people = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, take: 8, orderBy: { employeeCode: "asc" }, select: { id: true } });
  assert.equal(people.length, 8);
  const [E1, E2, E3, E4, E5, E6, E7] = people.map((p) => p.id) as [string, string, string, string, string, string, string];
  const before = await snapshot();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const later = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(Date.now() + 7 * 86_400_000));

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        await applyPendingRaterPairs(tx);
        // E1 is the manager of E2 and E3; nobody manages E4, and E5..E7 are only used as raters.
        await tx.employee.updateMany({ where: { id: { in: [E2, E3] } }, data: { managerId: E1 } });
        await tx.employee.updateMany({ where: { id: { in: [E4, E5, E6, E7] } }, data: { managerId: null } });
        const form = await createForm(COMPANY, hr, { name: "TE-แบบทดสอบจับคู่" });
        await updateForm(COMPANY, hr, form.id, { questions: [{ text: "TE ข้อทดสอบ", answerType: "RATING", weight: 1, required: true, visibleTo: [] }] } as any);
        await publishForm(COMPANY, hr, form.id);

        const mk = async (name: string, extra: Record<string, unknown> = {}) => {
          const r = await createRound(COMPANY, hr, name);
          await updateRound(COMPANY, hr, r.id, { formId: form.id, raterTypes: ["MANAGER"], perspectiveWeights: { MANAGER: 100 }, startDate: today, endDate: later, notifyLine: false, remind: false, participantIds: [E2, E3, E4], ...extra } as any);
          return r.id;
        };
        const keys = (d: Awaited<ReturnType<typeof getRound>>) => d.matching.rows.flatMap((r) => r.raters.map((x) => `${r.employeeId}<-${x.id}:${x.type}${x.manual ? "*" : ""}`)).sort();

        await t("H1 with nothing set by hand the matching is the org chart, as before", async () => {
          const id = await mk("TE-ต้นแบบ");
          const d = await getRound(COMPANY, id);
          assert.deepEqual(keys(d), [`${E2}<-${E1}:MANAGER`, `${E3}<-${E1}:MANAGER`].sort());
          assert.equal(d.matching.manual.added, 0);
          assert.equal(d.matching.exceptions.filter((e) => e.kind === "NO_RATER").length, 1, "E4 has nobody");
          assert.equal(d.ready, false);
        });

        await t("H2 pairs set by hand are added to the matching, marked, and make a round without a rater ready", async () => {
          const id = await mk("TE-เพิ่มคู่");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }, { participantId: E2, raterId: E6, raterType: "MANAGER" }], remove: [] } } as any);
          const d = await getRound(COMPANY, id);
          assert.deepEqual(keys(d), [`${E2}<-${E1}:MANAGER`, `${E2}<-${E6}:MANAGER*`, `${E3}<-${E1}:MANAGER`, `${E4}<-${E5}:MANAGER*`].sort());
          assert.equal(d.matching.manual.added, 2);
          assert.equal(d.matching.rows.find((r) => r.employeeId === E2)!.managers, 2);
          assert.equal(d.matching.exceptions.filter((e) => e.kind === "NO_RATER").length, 0);
          assert.equal(d.ready, true);
        });

        await t("H3 an automatic pair can be taken out, and the person then shows as without a rater", async () => {
          const id = await mk("TE-ตัดคู่");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [], remove: [{ participantId: E3, raterId: E1, raterType: "MANAGER" }] } } as any);
          const d = await getRound(COMPANY, id);
          assert.ok(!keys(d).some((k) => k.startsWith(`${E3}<-`)));
          assert.equal(d.matching.manual.removed, 1);
          assert.ok(d.matching.exceptions.some((e) => e.kind === "NO_RATER" && e.employeeId === E3));
        });

        await t("H4 pairs with unknown people are dropped when saved, duplicates kept once, and null clears everything", async () => {
          const id = await mk("TE-ล้าง");
          await updateRound(COMPANY, hr, id, {
            raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }, { participantId: E4, raterId: E5, raterType: "MANAGER" }, { participantId: E4, raterId: "00000000-0000-0000-0000-00000000dead", raterType: "MANAGER" }], remove: [] },
          } as any);
          assert.equal((await getRound(COMPANY, id)).overrides.add.length, 1);
          await updateRound(COMPANY, hr, id, { raterPairs: null } as any);
          const d = await getRound(COMPANY, id);
          assert.deepEqual(d.overrides, { add: [], remove: [] });
          assert.equal(d.matching.manual.added, 0);
        });

        await t("H5 saving other fields leaves the hand-set pairs alone", async () => {
          const id = await mk("TE-คงเดิม");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }], remove: [] } } as any);
          await updateRound(COMPANY, hr, id, { name: "TE-คงเดิม 2" } as any);
          assert.equal((await getRound(COMPANY, id)).overrides.add.length, 1);
        });

        await t("H6 taking someone out of the round takes their hand-set pairs with it, nothing invisible is left", async () => {
          const id = await mk("TE-ตกรอบ");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }, { participantId: E2, raterId: E6, raterType: "MANAGER" }], remove: [{ participantId: E4, raterId: E1, raterType: "MANAGER" }] } } as any);
          await updateRound(COMPANY, hr, id, { participantIds: [E2, E3] } as any);
          const d = await getRound(COMPANY, id);
          assert.deepEqual(d.overrides, { add: [{ participantId: E2, raterId: E6, raterType: "MANAGER" }], remove: [] });
          assert.equal(d.matching.manual.ignored, 0);
          assert.ok(!keys(d).some((k) => k.startsWith(`${E4}<-`)));
        });

        await t("H6b a pair of a type the round no longer uses is kept but ignored and counted", async () => {
          const id = await mk("TE-เปลี่ยนประเภท");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }], remove: [] } } as any);
          await updateRound(COMPANY, hr, id, { raterTypes: ["SELF"], perspectiveWeights: { SELF: 100 } } as any);
          const d = await getRound(COMPANY, id);
          assert.equal(d.matching.manual.ignored, 1);
          assert.ok(!keys(d).some((k) => k.includes(`<-${E5}:MANAGER`)));
          await updateRound(COMPANY, hr, id, { raterTypes: ["MANAGER"], perspectiveWeights: { MANAGER: 100 } } as any);
          assert.ok(keys(await getRound(COMPANY, id)).includes(`${E4}<-${E5}:MANAGER*`), "switching back restores it");
        });

        await t("H6c changing the pairs is described in the audit log", async () => {
          const id = await mk("TE-บันทึกการแก้");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }], remove: [] } } as any);
          const log = await tx.auditLog.findFirst({ where: { entityId: id, action: "appraisal_round.update" }, orderBy: { createdAt: "desc" }, select: { after: true } });
          assert.deepEqual((log?.after as any)?.raterPairs, { add: 1, remove: 0 });
        });

        await t("H7 opening the round creates exactly the assignments the matching showed, hand-set ones included", async () => {
          const id = await mk("TE-เปิดรอบ");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }, { participantId: E2, raterId: E6, raterType: "MANAGER" }, { participantId: E3, raterId: E7, raterType: "MANAGER" }], remove: [{ participantId: E3, raterId: E1, raterType: "MANAGER" }] } } as any);
          const shown = keys(await getRound(COMPANY, id)).map((k) => k.replace("*", ""));
          await openRound(COMPANY, hr, id);
          const rows = await tx.appraisalAssignment.findMany({ where: { participant: { roundId: id } }, select: { raterEmployeeId: true, raterType: true, participant: { select: { employeeId: true } } } });
          const made = rows.map((r: any) => `${r.participant.employeeId}<-${r.raterEmployeeId}:${r.raterType}`).sort();
          assert.deepEqual(made, shown.sort());
          assert.equal(made.length, 4);
        });

        await t("H8 a copied round keeps the hand-set pairs", async () => {
          const id = await mk("TE-ต้นฉบับ");
          await updateRound(COMPANY, hr, id, { raterPairs: { add: [{ participantId: E4, raterId: E5, raterType: "MANAGER" }], remove: [] } } as any);
          const copy = await cloneRound(COMPANY, hr, id);
          assert.deepEqual((await getRound(COMPANY, copy.id)).overrides.add, [{ participantId: E4, raterId: E5, raterType: "MANAGER" }]);
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
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; after the rollback the database is exactly as before: ${clean}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
