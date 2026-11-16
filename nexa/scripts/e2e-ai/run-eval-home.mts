/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { loadEvaluationOverview } from "@/features/dashboard-people/evaluation-overview";
import { cloneRound, listRounds, openRound } from "@/features/appraisal-round/service";

// The HR home evaluation panel against the real database, in ONE transaction that is thrown away. The template column is added
// inside the transaction (it does not exist yet) and the two template rounds are marked there, so nothing is kept.
const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
class Rollback extends Error {}

(async () => {
  const hasColumn = async () => ((await real.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_name = 'appraisal_rounds' AND column_name = 'isTemplate'`)) as unknown[]).length > 0;
  const before = { rounds: await real.appraisalRound.count(), participants: await real.appraisalParticipant.count(), audit: await real.auditLog.count(), column: await hasColumn() };
  const lines: string[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      lines.push(`PASS  ${name}`);
    } catch (e: any) {
      lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    }
  };

  const body = async (tx: any) => {
    g.__tx = tx;
    if (!before.column) await tx.$executeRawUnsafe(`ALTER TABLE "appraisal_rounds" ADD COLUMN "isTemplate" BOOLEAN NOT NULL DEFAULT false`);
    const marked = await tx.appraisalRound.updateMany({ where: { companyId: COMPANY, status: "DRAFT", name: { startsWith: "แม่แบบ" } }, data: { isTemplate: true } });
    const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
    const hr = { sub: actor, companyId: COMPANY, email: null, username: "hr.test", roles: [], perms: ["campaign:update", "campaign:approve", "campaign:manage", "campaign:read", "campaign:create"] } as any;
    const o: any = await loadEvaluationOverview(COMPANY, hr);
    // Drafts that are not templates already in the data (someone may have started a new round): they are real work waiting.
    const otherDrafts = await tx.appraisalRound.count({ where: { companyId: COMPANY, deletedAt: null, status: "DRAFT", isTemplate: false } });

    await check("the two template rounds are marked, and are not counted as work waiting", async () => {
      assert.equal(marked.count, 2);
      assert.equal(o.draftCount, otherDrafts);
      assert.equal(o.drafts.length, otherDrafts);
      assert.equal(o.templates.length, 2);
      assert.ok(o.templates.every((t: any) => !t.name.startsWith("แม่แบบ")));
    });
    await check("the last closed round is 8 Nov and the days since are counted", async () => {
      assert.ok(o.lastClosed, "no last closed round");
      assert.equal(o.lastClosed.endIso, "2026-11-08");
      const expect = Math.round((Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z") - Date.parse("2026-11-08T00:00:00Z")) / 86400000);
      assert.ok(Math.abs(o.lastClosed.daysAgo - expect) <= 1, `daysAgo ${o.lastClosed.daysAgo} vs ${expect}`);
    });
    await check("the results board shows both October rounds with their real counts at the top score", async () => {
      assert.equal(o.resultsBoard.length, 2);
      const tops = o.resultsBoard.map((b: any) => `${b.atTop}/${b.total}`).sort();
      assert.deepEqual(tops, ["18/30", "59/79"]);
      assert.ok(o.resultsBoard.every((b: any) => b.ceiling === true));
      for (const b of o.resultsBoard) assert.equal(b.spread.reduce((s: number, x: any) => s + x.count, 0), b.total);
    });
    await check("the average is compared only with the round before it in the same direction (September, never the other October round)", async () => {
      // Independent calculation: the previous round with the same kind of raters and the mean of its approved scores.
      const latest = await tx.appraisalRound.findUnique({ where: { id: o.results.roundId }, select: { raterTypes: true } });
      const others = await tx.appraisalRound.findMany({ where: { companyId: COMPANY, deletedAt: null, isTemplate: false, id: { not: o.results.roundId }, raterTypes: { equals: latest.raterTypes } }, orderBy: { closedAt: "desc" }, select: { id: true, name: true } });
      if (others.length === 0) {
        assert.equal(o.results.change, null);
        return;
      }
      const prev = await tx.appraisalParticipant.aggregate({ where: { roundId: others[0]!.id, resultStatus: { in: ["APPROVED", "PUBLISHED", "ACKNOWLEDGED"] }, scorePercent: { not: null } }, _avg: { scorePercent: true } });
      assert.ok(o.results.change, "there is an earlier round in the same direction, so a comparison is expected");
      assert.equal(o.results.change.previousName, others[0]!.name);
      assert.equal(o.results.change.delta, Math.round((o.results.average - Math.round(prev._avg.scorePercent! * 10) / 10) * 10) / 10);
    });
    await check("the rounds list marks templates", async () => {
      const list: any[] = (await listRounds(COMPANY)) as any;
      assert.equal(list.filter((r) => r.isTemplate).length, 2);
    });
    await check("a template cannot be opened itself", async () => {
      await assert.rejects(() => openRound(COMPANY, hr, o.templates[0].id), /แม่แบบ/);
    });
    await check("copying a template gives an ordinary draft named as a round, with the pairs kept", async () => {
      const tpl = await tx.appraisalRound.findFirst({ where: { id: o.templates[0].id }, select: { raterPairs: true, raterTypes: true } });
      const copy = await cloneRound(COMPANY, hr, o.templates[0].id);
      const c = await tx.appraisalRound.findUnique({ where: { id: copy.id }, select: { name: true, isTemplate: true, status: true, raterPairs: true, raterTypes: true } });
      assert.equal(c.isTemplate, false);
      assert.equal(c.status, "DRAFT");
      assert.ok(!c.name.startsWith("แม่แบบ"));
      assert.deepEqual(c.raterPairs, tpl.raterPairs);
      assert.deepEqual(c.raterTypes, tpl.raterTypes);
      const o2: any = await loadEvaluationOverview(COMPANY, hr);
      assert.equal(o2.draftCount, otherDrafts + 1, "the copy is work waiting");
      assert.equal(o2.templates.length, 2);
    });
    g.__tx = undefined;
    throw new Rollback();
  };
  try {
    await real.$transaction(body, { timeout: 180_000, maxWait: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = { rounds: await real.appraisalRound.count(), participants: await real.appraisalParticipant.count(), audit: await real.auditLog.count(), column: await hasColumn() };
  await check("the database is exactly as before", async () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
