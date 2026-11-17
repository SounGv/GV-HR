/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma as real } from "@real/prisma";
import { signAccessToken, signMfaToken, signAiProposalToken } from "@/lib/auth/jwt";
import { rolePermissionKeys } from "@/config/permissions";
import { setupTwoFactor } from "@/lib/auth/service";
import { GET as performanceGet } from "@/app/api/performance/route";
import { GET as requestsGet } from "@/app/api/workflows/requests/route";
import { POST as mfaSetupPost } from "@/app/api/auth/mfa/setup/route";

// Who may see what: the company-wide lists are for HR, a login step token is not a login, and 2FA cannot be re-enrolled
// over a live secret. Runs against the real database, inside ONE transaction that is thrown away at the end.
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

const preset = (name: string) => rolePermissionKeys({ name, isSystem: true, permissions: [] } as any);
const EMPLOYEE = preset("Employee");
const MANAGER = preset("Manager");
const HR = preset("HR Manager");

async function asUser(userId: string, perms: string[], roles: string[]) {
  g.__token = await signAccessToken({ sub: userId, companyId: COMPANY, email: null, username: null, roles, perms });
}
const call = (handler: (req: NextRequest) => Promise<Response>, url: string) => handler(new NextRequest(`http://x${url}`));

const snapshot = async () => ({ users: await real.user.count(), reviews: await real.performanceReview.count(), requests: await real.approvalRequest.count() });

(async () => {
  const template = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { passwordHash: true } }))!;
  const before = await snapshot();
  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        const make = (twoFactorEnabled: boolean) =>
          tx.user.create({ data: { companyId: COMPANY, username: `scope-test-${Math.random().toString(36).slice(2, 8)}`, passwordHash: template.passwordHash, twoFactorEnabled } as any, select: { id: true } });
        const user = await make(false);

        await t("S1 a Manager cannot list every performance review in the company, HR can, and a team list still works", async () => {
          await asUser(user.id, MANAGER, ["Manager"]);
          assert.equal((await call(performanceGet, "/api/performance?scope=all")).status, 403);
          assert.equal((await call(performanceGet, "/api/performance?scope=team")).status, 200);
          await asUser(user.id, HR, ["HR Manager"]);
          assert.equal((await call(performanceGet, "/api/performance?scope=all")).status, 200);
        });

        await t("S2 an employee or a manager cannot list every approval request, HR can, and their own and inbox lists still work", async () => {
          for (const [perms, role] of [[EMPLOYEE, "Employee"], [MANAGER, "Manager"]] as const) {
            await asUser(user.id, perms, [role]);
            assert.equal((await call(requestsGet, "/api/workflows/requests?scope=all")).status, 403, role);
            assert.equal((await call(requestsGet, "/api/workflows/requests?scope=me")).status, 200, role);
            assert.equal((await call(requestsGet, "/api/workflows/requests?scope=inbox")).status, 200, role);
          }
          await asUser(user.id, HR, ["HR Manager"]);
          assert.equal((await call(requestsGet, "/api/workflows/requests?scope=all")).status, 200);
        });

        await t("S3 the 2FA step token (and the AI card) is not a login: every route treats it as signed out", async () => {
          g.__token = await signMfaToken(user.id, true);
          assert.equal((await call(performanceGet, "/api/performance?scope=me")).status, 401);
          g.__token = await signAiProposalToken(user.id, COMPANY, { kind: "x" });
          assert.equal((await call(performanceGet, "/api/performance?scope=me")).status, 401);
          g.__token = await signMfaToken(user.id, true);
          assert.equal((await mfaSetupPost()).status, 401, "the step token cannot start a 2FA setup");
          const row = await tx.user.findUnique({ where: { id: user.id }, select: { twoFactorSecret: true } });
          assert.equal(row?.twoFactorSecret, null, "nothing was written");
        });

        await t("S4 a normal access token still works", async () => {
          await asUser(user.id, HR, ["HR Manager"]);
          assert.equal((await call(performanceGet, "/api/performance?scope=team")).status, 200);
          const res = await call(requestsGet, "/api/workflows/requests?scope=inbox");
          assert.equal(res.status, 200);
        });

        await t("S5 2FA cannot be set up again while it is on; with it off, setup still works", async () => {
          const off = user;
          const { secret } = await setupTwoFactor(off.id);
          assert.ok(secret);
          const on = await make(true);
          await tx.user.update({ where: { id: on.id }, data: { twoFactorSecret: "KEEP-ME" } });
          await assert.rejects(() => setupTwoFactor(on.id), /ปิดก่อน/);
          const row = await tx.user.findUnique({ where: { id: on.id }, select: { twoFactorSecret: true } });
          assert.equal(row?.twoFactorSecret, "KEEP-ME", "the secret that protects the account was not replaced");
        });

        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 60_000, maxWait: 30_000 },
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
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
