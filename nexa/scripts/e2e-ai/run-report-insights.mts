/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { prisma as real } from "@real/prisma";
import { getReport } from "@/features/report/service";
import { restoreFavpoWorld } from "./favpo-world.mts";

// The overview above the evaluation report, against the real database. The report is read inside a transaction that is thrown away (it first brings back
// the hidden Favpo rounds this suite was written for, see favpo-world.mts), and the suite fails if any row count changed.
const g = globalThis as any;
class Rollback extends Error {}
const COMPANY = "00000000-0000-0000-0000-000000000001";

(async () => {
  const before = { rounds: await real.appraisalRound.count(), participants: await real.appraisalParticipant.count(), audit: await real.auditLog.count() };
  let report!: Awaited<ReturnType<typeof getReport>>;
  try {
    await real.$transaction(
      async (tx) => {
        g.__tx = tx;
        await restoreFavpoWorld(tx);
        report = await getReport(COMPANY, { type: "performance" } as any);
        g.__tx = undefined;
        throw new Rollback();
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const rounds = report.evaluation?.rounds ?? [];
  const lines: string[] = [];
  const check = (name: string, fn: () => void) => {
    try {
      fn();
      lines.push(`PASS  ${name}`);
    } catch (e: any) {
      lines.push(`FAIL  ${name}\n      ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    }
  };

  check("the report offers an overview when results are approved or published", () => assert.ok(rounds.length > 0, "no rounds in the overview"));

  const tableByRound = new Map<string, number>();
  for (const row of report.rows) if (row.source === "รอบประเมิน") tableByRound.set(String(row.cycle), (tableByRound.get(String(row.cycle)) ?? 0) + 1);

  for (const r of rounds) {
    check(`${r.name}: the overview counts the same people as the table`, () => {
      assert.equal(r.count, tableByRound.get(r.name), `overview ${r.count} vs table ${tableByRound.get(r.name)}`);
    });
    check(`${r.name}: bands, departments and lists agree with the count`, () => {
      assert.equal(r.bands.reduce((s, b) => s + b.count, 0), r.count);
      assert.equal(r.departments.reduce((s, d) => s + d.count, 0), r.count);
      assert.equal(r.bands[r.bands.length - 1]!.count, r.atTop);
      assert.equal(r.top[0]?.percent, r.max);
      assert.equal(r.bottom[0]?.percent, r.min);
      assert.ok(r.top.length <= 10 && r.bottom.length <= 10);
      assert.ok(r.min <= r.average && r.average <= r.max);
    });
    lines.push(`      ${r.name}: ${r.count} people, average ${r.average}, ${r.min} to ${r.max}, ${r.atTop} at 100, ${r.departments.length} departments`);
  }

  const after = { rounds: await real.appraisalRound.count(), participants: await real.appraisalParticipant.count(), audit: await real.auditLog.count() };
  check("nothing was written", () => assert.deepEqual(after, before));
  for (const l of lines) console.log(l);
  await real.$disconnect();
  process.exit(lines.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
