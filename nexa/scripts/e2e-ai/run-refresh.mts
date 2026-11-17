/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { issueRefreshToken, revokeRefreshToken, rotateRefreshToken } from "@/lib/auth/token-store";

// Refresh-token rotation, against the real database but inside ONE transaction that is thrown away at the end:
// the tokens made here are never kept, and nobody's real session is touched (a throwaway user gets them).
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
const snapshot = async () => ({ tokens: await real.refreshToken.count(), users: await real.user.count() });

(async () => {
  const template = (await real.user.findFirst({ where: { companyId: COMPANY }, select: { passwordHash: true } }))!;
  const before = await snapshot();
  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        const user = await tx.user.create({ data: { companyId: COMPANY, username: `rt-test-${Date.now()}`, passwordHash: template.passwordHash } as any, select: { id: true } });
        const active = async () => tx.refreshToken.count({ where: { userId: user.id, revokedAt: null } });

        await t("F1 a normal refresh rotates the token and leaves one active", async () => {
          const first = await issueRefreshToken(user.id);
          const next = await rotateRefreshToken(first.token);
          assert.ok(next && next.token !== first.token);
          assert.equal(await active(), 1);
        });

        await t("F2 a second refresh with the token just rotated is accepted, and the first one's new token still works", async () => {
          const first = await issueRefreshToken(user.id);
          const winner = await rotateRefreshToken(first.token);
          const loser = await rotateRefreshToken(first.token); // the same cookie arriving a moment later
          assert.ok(winner && loser, "both requests get a session");
          assert.notEqual(winner!.token, loser!.token);
          assert.ok(await rotateRefreshToken(winner!.token), "the winner's token is not revoked by the race");
        });

        await t("F3 a rotated token used long after is still treated as theft: everything for the user is revoked", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
          const first = await issueRefreshToken(user.id);
          const next = await rotateRefreshToken(first.token);
          assert.ok(next);
          await tx.refreshToken.update({ where: { id: first.jti }, data: { revokedAt: new Date(Date.now() - 60_000) } }); // rotated a minute ago
          assert.equal(await rotateRefreshToken(first.token), null);
          assert.equal(await active(), 0, "the successor was revoked too");
        });

        // A rotation that happened `ago` ms in the past: the old token's revocation and its successor's creation both move back.
        const rotatedAgo = async (ago: number, usedSuccessor: boolean, agent?: string) => {
          const meta = agent ? { userAgent: agent } : undefined;
          const first = await issueRefreshToken(user.id, meta);
          const second = (await rotateRefreshToken(first.token, meta))!;
          if (usedSuccessor) await rotateRefreshToken(second.token, meta); // the browser did get the new token and used it
          const past = new Date(Date.now() - ago);
          await tx.refreshToken.update({ where: { id: first.jti }, data: { revokedAt: past } });
          await tx.refreshToken.update({ where: { id: second.jti }, data: { createdAt: past } });
          return first;
        };

        await t("F3a the old token coming back after the new one was used is theft once the short window has passed", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
          const first = await rotatedAgo(120_000, true);
          assert.equal(await rotateRefreshToken(first.token), null);
          assert.equal(await active(), 0);
        });

        await t("F3b an answer that never reached the browser: the old token is accepted again within 5 minutes and nobody is signed out", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
          const first = await rotatedAgo(180_000, false, "phone");
          const again = await rotateRefreshToken(first.token, { userAgent: "phone" });
          assert.ok(again, "the old token still opens a session");
          assert.ok((await active()) >= 2, "the unused successor was not revoked");
        });

        await t("F3c the same after more than 5 minutes is treated as theft", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
          const first = await rotatedAgo(360_000, false, "phone");
          assert.equal(await rotateRefreshToken(first.token, { userAgent: "phone" }), null);
          assert.equal(await active(), 0);
        });

        await t("F3d the late old token from a different browser is theft even inside the window, and a changed network address alone is not", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
          const first = await rotatedAgo(120_000, false, "phone");
          assert.equal(await rotateRefreshToken(first.token, { userAgent: "another browser" }), null);
          assert.equal(await active(), 0);
          // the same phone on another network: the address is not part of the check
          const first2 = await issueRefreshToken(user.id, { ip: "10.0.0.1", userAgent: "phone" });
          await rotateRefreshToken(first2.token, { ip: "10.0.0.1", userAgent: "phone" });
          const late = await rotateRefreshToken(first2.token, { ip: "10.9.9.9", userAgent: "phone" });
          assert.ok(late, "a different address with the same browser is accepted inside the window");
        });

        await t("F4 a token revoked by logout is never accepted again, even a second later", async () => {
          // the tokens made by the earlier cases are minutes old, as a real user's other sessions would be
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 600_000) } });
          const first = await issueRefreshToken(user.id);
          await revokeRefreshToken(first.token);
          assert.equal(await rotateRefreshToken(first.token), null);
        });

        await t("F4b a login on another device a moment after a logout does not reopen the logged-out token", async () => {
          await tx.refreshToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 600_000) } });
          const first = await issueRefreshToken(user.id, { ip: "1.1.1.1", userAgent: "laptop" });
          await revokeRefreshToken(first.token);
          await issueRefreshToken(user.id, { ip: "2.2.2.2", userAgent: "phone" }); // someone logs in elsewhere right now
          assert.equal(await rotateRefreshToken(first.token, { ip: "1.1.1.1", userAgent: "laptop" }), null);
        });

        await t("F5 an unknown or tampered token is refused", async () => {
          const first = await issueRefreshToken(user.id);
          assert.equal(await rotateRefreshToken(first.token + "x"), null);
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
})().catch((e) => { console.error(e); process.exit(2); });
