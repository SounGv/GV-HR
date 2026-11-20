/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma as real } from "@real/prisma";
import { getDetailOverview, getDetailPerson } from "@/features/appraisal-round/detail-report-service";

// The detailed evaluation report reads what is stored and writes nothing. This runs it against the real database and checks
// that the numbers hold together: ranks, team means, the rater table and the score matrix agree with each other.
const COMPANY = "00000000-0000-0000-0000-000000000001";
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
  const count = async () => ({ participants: await real.appraisalParticipant.count(), assignments: await real.appraisalAssignment.count(), audit: await real.auditLog.count() });
  const before = await count();
  const overview = await getDetailOverview(COMPANY, null);
  mkdirSync(".tmp-e2e", { recursive: true });
  writeFileSync(".tmp-e2e/detail-overview.json", JSON.stringify(overview));

  await t("D1 the overview lists rounds newest first and picks the newest by default", async () => {
    assert.ok(overview.rounds.length >= 1, "no scored round in the database");
    assert.equal(overview.roundId, overview.rounds[0].id);
    assert.equal(overview.people.length, overview.rounds[0].people);
  });
  await t("D2 ranks follow the scores and equal scores share a rank", async () => {
    const p = overview.people;
    for (let i = 1; i < p.length; i++) {
      assert.ok(p[i].total <= p[i - 1].total, "people are sorted from the highest score");
      if (p[i].total === p[i - 1].total) assert.equal(p[i].rank, p[i - 1].rank);
      else assert.ok(p[i].rank > p[i - 1].rank);
    }
    assert.equal(p[0].rank, 1);
  });
  await t("D3 every team count and mean come from its people", async () => {
    let sum = 0;
    for (const team of overview.teams) {
      const mine = overview.people.filter((x) => x.department === team.department);
      assert.equal(team.count, mine.length);
      const mean = Math.round((mine.reduce((s, x) => s + x.total, 0) / mine.length) * 10) / 10;
      assert.equal(team.avg, mean);
      assert.equal(team.min, Math.min(...mine.map((x) => x.total)));
      assert.equal(team.max, Math.max(...mine.map((x) => x.total)));
      sum += team.count;
    }
    assert.equal(sum, overview.people.length);
  });
  await t("D4 history ends at the chosen round and has one value per round for every team", async () => {
    const h = overview.history;
    assert.equal(h.rounds[h.rounds.length - 1].id, overview.roundId);
    assert.equal(h.company.length, h.rounds.length);
    for (const team of h.teams) assert.equal(team.values.length, h.rounds.length);
  });

  const sample = overview.people.slice(0, 6);
  const details: any[] = [];
  for (const p of sample) details.push(await getDetailPerson(COMPANY, overview.roundId as string, p.participantId));
  writeFileSync(".tmp-e2e/detail-person.json", JSON.stringify(details));

  await t("D5 a person header agrees with the overview", async () => {
    for (const d of details) {
      const o = overview.people.find((x) => x.participantId === d.participantId)!;
      assert.equal(d.total, o.total);
      assert.equal(d.rank, o.rank);
      assert.equal(d.rankOf, overview.people.length);
      assert.equal(d.prev, o.prev);
    }
  });
  await t("D6 the matrix has one score per rater per question and its columns are submitted raters", async () => {
    for (const d of details) {
      for (const row of d.matrix.rows) {
        assert.equal(row.scores.length, d.matrix.columns.length);
        for (const s of row.scores) assert.ok(s === null || (s >= 1 && s <= d.ratingMax));
      }
      const submitted = new Set(d.raters.filter((r: any) => r.status === "SUBMITTED").map((r: any) => r.assignmentId));
      for (const c of d.matrix.columns) assert.ok(submitted.has(c.assignmentId));
    }
  });
  await t("D7 only submitted sheets carry a score or a comment", async () => {
    for (const d of details) {
      for (const r of d.raters) if (r.status !== "SUBMITTED") assert.equal(r.percent, null);
      const submitted = new Set(d.raters.filter((r: any) => r.status === "SUBMITTED").map((r: any) => r.assignmentId));
      for (const c of d.comments) assert.ok(submitted.has(c.assignmentId));
    }
  });
  await t("D8 rater weights add up to about 100 across the perspectives that answered", async () => {
    for (const d of details) {
      if (d.types.length === 0) continue;
      const total = d.types.reduce((s: number, x: any) => s + x.weightUsed, 0);
      assert.ok(Math.abs(total - 100) <= 0.5, `weights ${total}`);
    }
  });
  await t("D9 history for a person lines up with the rounds and ends with their own score", async () => {
    for (const d of details) {
      const h = d.history;
      assert.equal(h.me.length, h.rounds.length);
      assert.equal(h.dept.length, h.rounds.length);
      assert.equal(h.company.length, h.rounds.length);
      assert.equal(h.me[h.me.length - 1], d.total);
    }
  });
  await t("D10 an unknown participant is not found", async () => {
    await assert.rejects(() => getDetailPerson(COMPANY, overview.roundId as string, "00000000-0000-0000-0000-0000000000ff"), /ไม่พบ/);
  });

  const after = await count();
  for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.err ? "\n      " + x.err : ""}`);
  const clean = JSON.stringify(before) === JSON.stringify(after);
  console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed; database unchanged: ${clean}`);
  console.log(`rounds=${overview.rounds.length} people=${overview.people.length} teams=${overview.teams.length}; people with comments: ${details.filter((d) => d.comments.length).length}/${details.length}`);
  await real.$disconnect();
  process.exit(results.every((x) => x.ok) && clean ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
