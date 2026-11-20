/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { updateEmployee } from "@/features/employee/service";

// The supervisor page saves each change through the same employee update as the employee form. Inside ONE transaction that
// is thrown away: a person can be brought into a team and taken out again (null clears the link), and nobody can be put
// under themselves or under someone who works under them.
const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
class Rollback extends Error {}
const results: { name: string; ok: boolean; err?: string }[] = [];
async function t(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e: any) {
    results.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 4).join(" | ") });
  }
}

(async () => {
  const user = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
  const people = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null, status: "ACTIVE" }, take: 3, orderBy: { employeeCode: "asc" }, select: { id: true } });
  assert.equal(people.length, 3);
  const [A, B, C] = people.map((p) => p.id) as [string, string, string];
  const session: any = { sub: user, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["*"] };
  const before = { employees: await real.employee.count(), audit: await real.auditLog.count() };
  const managerOf = async (id: string) => (await real.employee.findUniqueOrThrow({ where: { id }, select: { managerId: true } })).managerId;
  const original = new Map<string, string | null>();
  for (const id of [A, B, C]) original.set(id, await managerOf(id));

  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        const mgr = async (id: string) => (await tx.employee.findUniqueOrThrow({ where: { id }, select: { managerId: true } })).managerId;
        // Start clean inside the transaction so the checks do not depend on the live reporting lines.
        await tx.employee.updateMany({ where: { id: { in: [A, B, C] } }, data: { managerId: null } });

        await t("S1 bringing B into A's team sets B's supervisor, and taking B out clears it", async () => {
          await updateEmployee(COMPANY, B, { managerId: A } as any, session);
          assert.equal(await mgr(B), A);
          await updateEmployee(COMPANY, B, { managerId: null } as any, session);
          assert.equal(await mgr(B), null);
        });
        await t("S2 moving C from A to B changes only C", async () => {
          await updateEmployee(COMPANY, C, { managerId: A } as any, session);
          await updateEmployee(COMPANY, B, { managerId: A } as any, session);
          await updateEmployee(COMPANY, C, { managerId: B } as any, session);
          assert.equal(await mgr(C), B);
          assert.equal(await mgr(B), A);
          assert.equal(await mgr(A), null);
        });
        await t("S3 nobody can be put under themselves", async () => {
          await assert.rejects(() => updateEmployee(COMPANY, A, { managerId: A } as any, session), /ของตัวเอง/);
        });
        await t("S4 nobody can be put under someone who works under them (no loop)", async () => {
          // A -> B -> C is the chain now (B under A, C under B); putting A under C would close the loop.
          await assert.rejects(() => updateEmployee(COMPANY, A, { managerId: C } as any, session));
          assert.equal(await mgr(A), null, "A stays where they were");
        });
        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = { employees: await real.employee.count(), audit: await real.auditLog.count() };
  let same = true;
  for (const id of [A, B, C]) if ((await managerOf(id)) !== original.get(id)) same = false;
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  const clean = JSON.stringify(before) === JSON.stringify(after) && same;
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; database exactly as before: ${clean}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
