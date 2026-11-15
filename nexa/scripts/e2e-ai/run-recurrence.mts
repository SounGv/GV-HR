/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma as real } from "@real/prisma";
import { applyPendingMigration } from "./pending-migration.mts";
import { createRecurrence, deleteRecurrence, listRecurrences, makeDueRecurringRounds, updateRecurrence } from "@/features/appraisal-round/recurrence-service";

// Recurring rounds, against the real database but inside ONE transaction that is thrown away at the end. The new tables may not be
// on the live database yet, so the migration file runs inside the transaction first. LINE and email are switched off.
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
let USER = "";
const claims = () => ({ sub: USER, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["campaign:update", "campaign:manage"] });
const snapshot = async () => ({
  rounds: await real.appraisalRound.count(),
  participants: await real.appraisalParticipant.count(),
  notifications: await real.notification.count(),
  audit: await real.auditLog.count(),
  forms: await real.appraisalForm.count(),
});
const refused = (msg: RegExp) => (e: unknown) => msg.test(String((e as Error)?.message));

(async () => {
  USER = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const form = (await real.appraisalForm.findFirst({ where: { companyId: COMPANY, status: "PUBLISHED", deletedAt: null }, select: { id: true } }))!;
  assert.ok(form, "the company has a published form");
  const withDept = (await real.employee.findFirst({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE", departmentId: { not: null } }, select: { department: { select: { name: true } } } }))!;
  const dept = withDept.department!.name;
  const before = await snapshot();

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        await applyPendingMigration(tx);
        const active = await tx.employee.count({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" } });
        const inDept = await tx.employee.count({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE", department: { name: dept } } });
        const holders = await tx.employee.count({ where: { companyId: COMPANY, deletedAt: null, user: { roles: { some: { role: { permissions: { some: { permission: { key: "campaign:update" } } } } } } } } });
        const body = { name: "ประเมินประจำเดือน {เดือน} {ปี}", frequency: "MONTHLY" as const, openDay: 1, closeDay: 7, formId: form.id, preset: "180", departmentNames: [] as string[] };
        const notes = (title: string) => tx.notification.count({ where: { companyId: COMPANY, title } });
        let main = "";

        await t("K1 the migration runs, a valid setup is saved, and bad ones are refused with a reason", async () => {
          await assert.rejects(() => createRecurrence(COMPANY, claims(), { ...body, openDay: 29, closeDay: 29 }), refused(/1 ถึง 28/));
          await assert.rejects(() => createRecurrence(COMPANY, claims(), { ...body, openDay: 10, closeDay: 9 }), refused(/ไม่ก่อนวันเปิด/));
          await assert.rejects(() => createRecurrence(COMPANY, claims(), { ...body, preset: "45" }), refused(/ผู้ประเมิน/));
          await assert.rejects(() => createRecurrence(COMPANY, claims(), { ...body, formId: randomUUID() }), refused(/แบบประเมินที่ใช้งานแล้ว/));
          assert.equal(await tx.appraisalRecurrence.count({ where: { companyId: COMPANY } }), 0, "nothing saved by the refused ones");
          main = (await createRecurrence(COMPANY, claims(), body)).id;
          assert.equal(await tx.appraisalRecurrence.count({ where: { companyId: COMPANY } }), 1);
        });

        await t("K2 the list shows the next three rounds with the names they will get, and none made yet", async () => {
          const l = await listRecurrences(COMPANY);
          assert.equal(l.length, 1);
          assert.equal(l[0]!.roundsMade, 0);
          assert.equal(l[0]!.lastRound, null);
          assert.equal(l[0]!.upcoming.length, 3);
          assert.match(l[0]!.upcoming[0]!.name, /^ประเมินประจำเดือน .+ 25\d\d$/);
          assert.deepEqual(l[0]!.upcoming.map((u) => u.periodKey), [...new Set(l[0]!.upcoming.map((u) => u.periodKey))], "periods are different");
        });

        await t("K3 the day before the draft window nothing is made", async () => {
          const r = await makeDueRecurringRounds("2026-11-27");
          assert.deepEqual(r, { made: 0, nudged: 0, skipped: 0, failed: 0 });
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: main } }), 0);
        });

        await t("K4 three days before opening a DRAFT is made with the saved setup, never opened, and HR are told", async () => {
          const r = await makeDueRecurringRounds("2026-11-28");
          assert.equal(r.made, 1);
          const rounds = await tx.appraisalRound.findMany({ where: { recurrenceId: main }, include: { participants: true } });
          assert.equal(rounds.length, 1);
          const x = rounds[0]!;
          assert.equal(x.name, "ประเมินประจำเดือน พฤศจิกายน 2569");
          assert.equal(x.status, "DRAFT");
          assert.equal(x.openedAt, null);
          assert.equal(x.formId, form.id);
          assert.equal(x.periodKey, "2026-11");
          assert.equal(x.startDate?.toISOString().slice(0, 10), "2026-12-01");
          assert.equal(x.endDate?.toISOString().slice(0, 10), "2026-12-07");
          assert.deepEqual([...x.raterTypes].sort(), ["MANAGER", "SELF"]);
          assert.deepEqual(x.perspectiveWeights, { MANAGER: 70, SELF: 30 });
          assert.equal(x.participants.length, active, "everyone active is in");
          assert.equal(await tx.appraisalAssignment.count({ where: { participant: { roundId: x.id } } }), 0, "no rater messages exist before HR open it");
          assert.equal(await notes("ร่างรอบประเมินพร้อมให้ตรวจ"), holders, "one in-app notice for each person who can run rounds");
          const n = await tx.notification.findFirst({ where: { title: "ร่างรอบประเมินพร้อมให้ตรวจ" } });
          assert.equal(n?.category, "system", "in the bell only, no LINE");
          assert.equal(n?.link, `/appraisal/rounds/${x.id}`);
        });

        await t("K5 running the job again the same day makes nothing more", async () => {
          const r = await makeDueRecurringRounds("2026-11-28");
          assert.equal(r.made, 0);
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: main } }), 1);
          assert.equal(await notes("ร่างรอบประเมินพร้อมให้ตรวจ"), holders, "and no second notice");
        });

        await t("K6 the database itself refuses a second round for the same period", async () => {
          await tx.$executeRawUnsafe("SAVEPOINT dup");
          await assert.rejects(
            () => tx.appraisalRound.create({ data: { companyId: COMPANY, name: "ซ้ำ", formId: form.id, recurrenceId: main, periodKey: "2026-11" } }),
            (e: any) => e?.code === "P2002",
          );
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT dup");
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: main } }), 1);
        });

        await t("K7 on the opening day a draft still waiting gets one nudge, and not on the next day", async () => {
          const a = await makeDueRecurringRounds("2026-12-01");
          assert.deepEqual([a.made, a.nudged], [0, 1]);
          assert.equal(await notes("ถึงวันเปิดรอบแล้ว รอ HR กดเปิด"), holders);
          const b = await makeDueRecurringRounds("2026-12-02");
          assert.deepEqual([b.made, b.nudged], [0, 0]);
        });

        await t("K8 a draft HR already opened is not nudged, and one HR deleted is not made again", async () => {
          const round = (await tx.appraisalRound.findFirst({ where: { recurrenceId: main } }))!;
          await tx.appraisalRound.update({ where: { id: round.id }, data: { status: "OPEN" } });
          const a = await makeDueRecurringRounds("2026-12-01");
          assert.equal(a.nudged, 0, "already open");
          await tx.appraisalRound.update({ where: { id: round.id }, data: { status: "DRAFT", deletedAt: new Date() } });
          const b = await makeDueRecurringRounds("2026-12-03");
          assert.equal(b.made, 0, "a deleted draft is a decision, not something to remake");
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: main } }), 1);
        });

        await t("K9 once the round has closed a late setup makes nothing for it", async () => {
          const r = await makeDueRecurringRounds("2026-12-08");
          assert.equal(r.made, 0);
        });

        await t("K10 only people of the chosen departments are included", async () => {
          const id = (await createRecurrence(COMPANY, claims(), { ...body, name: "เฉพาะแผนก {เดือน}", departmentNames: [dept] })).id;
          const r = await makeDueRecurringRounds("2027-01-29");
          assert.equal(r.made, 2, "this setup's round and the main setup's January round");
          const mine = (await tx.appraisalRound.findFirst({ where: { recurrenceId: id }, include: { participants: true } }))!;
          assert.equal(mine.participants.length, inDept);
          assert.ok(inDept > 0 && inDept <= active);
          assert.ok(mine.participants.every((p) => p.departmentName === dept));
          assert.equal(mine.name, "เฉพาะแผนก มกราคม", "the round opening on 1 February is for January");
        });

        await t("K11 a stopped or deleted setup makes nothing, and editing changes what is made next", async () => {
          const l = await listRecurrences(COMPANY);
          const dep = l.find((x) => x.name.startsWith("เฉพาะแผนก"))!;
          await updateRecurrence(COMPANY, claims(), dep.id, { ...body, name: "เปลี่ยนชื่อ {เดือน}", departmentNames: [dept], enabled: false });
          const off = await makeDueRecurringRounds("2027-02-28");
          assert.equal(off.made, 1, "only the main setup (the stopped one is skipped)");
          await deleteRecurrence(COMPANY, claims(), dep.id);
          assert.equal((await listRecurrences(COMPANY)).some((x) => x.id === dep.id), false, "gone from the list");
          const rounds = await tx.appraisalRound.count({ where: { recurrenceId: dep.id } });
          assert.equal(rounds, 1, "the round it already made stays");
        });

        await t("K12 a form that was archived with no newer version stops the draft and tells HR once", async () => {
          const old = await tx.appraisalForm.create({ data: { companyId: COMPANY, lineageId: randomUUID(), version: 1, name: "แบบทดสอบที่เลิกใช้", status: "ARCHIVED", ratingMax: 5 } });
          const rec = await tx.appraisalRecurrence.create({ data: { companyId: COMPANY, name: "แบบเก่า {เดือน}", frequency: "MONTHLY", openDay: 1, closeDay: 7, formId: old.id, preset: "90", departmentNames: [] } });
          const a = await makeDueRecurringRounds("2027-03-29");
          assert.ok(a.skipped >= 1);
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: rec.id } }), 0, "no round without a usable form");
          assert.equal(await notes("สร้างรอบอัตโนมัติไม่ได้"), holders, "told on the first day of the window");
          await makeDueRecurringRounds("2027-03-30");
          assert.equal(await notes("สร้างรอบอัตโนมัติไม่ได้"), holders, "not again the next day");
        });

        await t("K13 a setup that fails does not stop the others, and the whole job still sends invitations", async () => {
          // A setup with an unknown preset throws while its round is made; a healthy one is due the same day.
          const bad = await tx.appraisalRecurrence.create({ data: { companyId: COMPANY, name: "พัง {เดือน}", frequency: "MONTHLY", openDay: 1, closeDay: 7, formId: form.id, preset: "bogus", departmentNames: [] } });
          const good = await tx.appraisalRecurrence.create({ data: { companyId: COMPANY, name: "ปกติ {เดือน}", frequency: "MONTHLY", openDay: 1, closeDay: 7, formId: form.id, preset: "90", departmentNames: [] } });
          const r = await makeDueRecurringRounds("2027-04-28");
          assert.ok(r.failed >= 1, "the broken setup is counted, not thrown");
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: bad.id } }), 0);
          assert.equal(await tx.appraisalRound.count({ where: { recurrenceId: good.id } }), 1, "the healthy setup still made its draft");
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 240_000, maxWait: 30_000 },
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
