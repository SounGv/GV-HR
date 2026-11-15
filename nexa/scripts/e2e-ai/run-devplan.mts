/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { addProgressNote, updateItem } from "@/features/development-plan/service";

// Development plan fixes, against the real database inside ONE transaction that is thrown away at the end:
//  - two progress notes written at the same moment both stay (the append happens inside the database);
//  - reopening a completed item clears its completion date.
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

(async () => {
  const user = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const emp = (await real.employee.findFirst({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, select: { id: true } }))!;
  const before = { plans: await real.developmentPlan.count(), items: await real.developmentItem.count(), audit: await real.auditLog.count() };
  const session: any = { sub: user, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["*"], employeeId: emp.id };
  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        const plan = await tx.developmentPlan.create({ data: { companyId: COMPANY, employeeId: emp.id, cycle: "TEST-DEVPLAN" } });
        const item = await tx.developmentItem.create({ data: { planId: plan.id, title: "ทดสอบ" } });
        const notesOf = async () => ((await tx.developmentItem.findUniqueOrThrow({ where: { id: item.id } })).progressNotes as { note: string }[] | null) ?? [];

        await t("D1 notes are appended in order and none is lost, including notes written together", async () => {
          await addProgressNote(COMPANY, session, item.id, "หนึ่ง");
          await addProgressNote(COMPANY, session, item.id, "สอง");
          // Same moment: both statements run against the same row; each must keep the other's note.
          await Promise.all([addProgressNote(COMPANY, session, item.id, "สาม"), addProgressNote(COMPANY, session, item.id, "สี่")]);
          const notes = (await notesOf()).map((n) => n.note);
          assert.deepEqual(notes.slice(0, 2), ["หนึ่ง", "สอง"]);
          assert.deepEqual(new Set(notes), new Set(["หนึ่ง", "สอง", "สาม", "สี่"]));
          assert.equal(notes.length, 4);
        });

        await t("D2 completing sets the date and reopening clears it", async () => {
          await updateItem(COMPANY, session, item.id, { status: "COMPLETED" } as any);
          assert.ok((await tx.developmentItem.findUniqueOrThrow({ where: { id: item.id } })).completedAt, "completion date set");
          await updateItem(COMPANY, session, item.id, { status: "IN_PROGRESS" } as any);
          assert.equal((await tx.developmentItem.findUniqueOrThrow({ where: { id: item.id } })).completedAt, null, "completion date cleared");
          await updateItem(COMPANY, session, item.id, { title: "แก้ชื่ออย่างเดียว" } as any);
          assert.equal((await tx.developmentItem.findUniqueOrThrow({ where: { id: item.id } })).completedAt, null, "a change that is not about status leaves it alone");
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = { plans: await real.developmentPlan.count(), items: await real.developmentItem.count(), audit: await real.auditLog.count() };
  const clean = JSON.stringify(before) === JSON.stringify(after);
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; database exactly as before: ${clean}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
