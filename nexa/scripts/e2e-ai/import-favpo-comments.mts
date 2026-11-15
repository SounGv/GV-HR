/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
// One-off import of the written comments from the two October 2569 Favpo rounds into the rounds already imported.
//
//   dry   (default)  writes inside ONE transaction, checks the result with the app's own service, then throws the transaction
//                    away. Nothing is kept. Prints the standard DryRun report. Works before the migration: the column is added
//                    inside the same transaction and goes away with it.
//   apply            the same writes, committed. Run only after the owner has said yes to the DryRun report and the migration is applied.
//
// Run:  node scripts/e2e-ai/build.mjs import-favpo-comments && node --env-file=.env.local .tmp-e2e/import-favpo-comments.cjs <comments.txt> [dry|apply]
// Input lines:  d|u , person full name , raters in the round , comments joined by ¦     ("d" = หัวหน้าประเมินลูกน้อง, "u" = ลูกน้องประเมินหัวหน้า)
//
// What is copied: the typed comments, per person and round. Not copied: who wrote them (Favpo's report does not say which rater wrote which).
// Rows that already hold comments are left alone, so running it twice changes nothing the second time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prisma as real } from "@real/prisma";
import { getParticipantResult } from "@/features/appraisal-round/service";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MODE = process.argv[3] === "apply" ? "apply" : "dry";
class Rollback extends Error {}

const ROUNDS = {
  d: { name: "ตุลาคม 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", raterType: "MANAGER" },
  u: { name: "ตุลาคม 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", raterType: "SUBORDINATE" },
} as const;
type Key = keyof typeof ROUNDS;

const norm = (s: string) => s.replace(/[\s​ ]+/g, "");
const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};

type Row = { key: Key; name: string; raters: number; texts: string[] };
function parse(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const [key, name, raters, ...rest] = l.split("|");
      assert.ok(key === "d" || key === "u", `unknown round key "${key}"`);
      return { key, name: name!, raters: Number(raters), texts: rest.join("|").split("¦").map((t) => t.trim()).filter(Boolean) };
    });
}

const hasColumn = async (db: any) =>
  ((await db.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_name = 'appraisal_participants' AND column_name = 'importedComments'`)) as unknown[]).length > 0;

(async () => {
  const raw = readFileSync(process.argv[2]!, "utf8");
  const rows = parse(raw);

  const snapshot = async () => ({
    participants: await real.appraisalParticipant.count(),
    assignments: await real.appraisalAssignment.count(),
    rounds: await real.appraisalRound.count(),
    audit: await real.auditLog.count(),
    columnExists: await hasColumn(real),
  });
  const before = await snapshot();
  if (MODE === "apply") assert.ok(before.columnExists, "apply the migration first: the importedComments column does not exist yet");

  const checks: { name: string; ok: boolean; err?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e: any) {
      checks.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 4).join(" | ") });
    }
  };

  type Match = { row: Row; participantId: string; employeeId: string; managerId: string | null; breakdownRaters: number };
  const matched: Match[] = [];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const alreadyHas: string[] = [];
  const duplicateTargets: string[] = [];

  const body = async (tx: any) => {
    g.__tx = tx;
    // A dry run runs before the migration: add the column inside this transaction, which is thrown away with everything else.
    if (MODE === "dry" && !before.columnExists) await tx.$executeRawUnsafe(`ALTER TABLE "appraisal_participants" ADD COLUMN "importedComments" JSONB`);

    const rounds = await tx.appraisalRound.findMany({
      where: { companyId: COMPANY, deletedAt: null, name: { in: [ROUNDS.d.name, ROUNDS.u.name] } },
      select: { id: true, name: true, participants: { select: { id: true, importedComments: true, scoreBreakdown: true, employee: { select: { id: true, firstName: true, lastName: true, nickname: true, managerId: true } } } } },
    });
    assert.equal(rounds.length, 2, "both imported October rounds must exist");
    const roundOf = (k: Key) => rounds.find((r: any) => r.name === ROUNDS[k].name)!;

    const seen = new Set<string>();
    for (const row of rows) {
      const inRound = roundOf(row.key).participants;
      let cands = inRound.filter((p: any) => norm(`${p.employee.firstName}${p.employee.lastName ?? ""}`) === norm(row.name));
      // Favpo lists a few people by first name or nickname only.
      if (cands.length === 0) cands = inRound.filter((p: any) => norm(p.employee.firstName) === norm(row.name) || (p.employee.nickname && norm(p.employee.nickname) === norm(row.name) && !p.employee.lastName));
      if (cands.length === 0) unmatched.push(`${row.key}:${row.name}`);
      else if (cands.length > 1) ambiguous.push(`${row.key}:${row.name}`);
      else {
        const p = cands[0]!;
        if (seen.has(p.id)) duplicateTargets.push(`${row.key}:${row.name}`);
        else if (p.importedComments) alreadyHas.push(`${row.key}:${row.name}`);
        else {
          seen.add(p.id);
          const bd = (p.scoreBreakdown as any)?.types?.[0]?.raters;
          matched.push({ row, participantId: p.id, employeeId: p.employee.id, managerId: p.employee.managerId, breakdownRaters: typeof bd === "number" ? bd : 0 });
        }
      }
    }

    for (const m of matched) {
      // The count stored is the one the round already holds (it decides who may read the comments), not the file's.
      await tx.appraisalParticipant.update({
        where: { id: m.participantId },
        data: { importedComments: { source: "favpo", raterType: ROUNDS[m.row.key].raterType, raters: m.breakdownRaters, texts: m.row.texts } as any },
      });
    }
    await tx.auditLog.create({
      data: { companyId: COMPANY, action: "appraisal_round.import_favpo_comments", entity: "AppraisalRound", entityId: roundOf("d").id, after: { rounds: [roundOf("d").id, roundOf("u").id], people: matched.length, comments: matched.reduce((a, m) => a + m.row.texts.length, 0), source: "Favpo Y2026 October" } as any },
    });

    if (MODE === "dry") {
      const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
      const claims = (perms: string[], employeeId?: string) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.dry", roles: [], perms, employeeId });
      const HR = ["campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
      const MGR = ["campaign:manage", "campaign:read"];
      await t("the rows written agree with the report", async () => {
        const n = await tx.appraisalParticipant.count({ where: { importedComments: { not: null } } });
        assert.equal(n, matched.length);
        assert.equal(await tx.appraisalAssignment.count(), before.assignments, "no rater is invented");
      });
      await t("HR read every comment of every matched person", async () => {
        let total = 0;
        for (const m of matched) {
          const r: any = await getParticipantResult(COMPANY, roundOf(m.row.key).id, m.participantId, claims(HR) as any);
          assert.ok(r.importedComments && !r.importedComments.hidden, `${m.row.name} hidden from HR`);
          assert.deepEqual(r.importedComments.texts, m.row.texts);
          total += r.importedComments.texts.length;
        }
        assert.equal(total, matched.reduce((a, m) => a + m.row.texts.length, 0));
      });
      await t("a manager reads downward comments but upward ones only from three or more people", async () => {
        let shown = 0;
        let held = 0;
        for (const m of matched) {
          if (!m.managerId) continue;
          const r: any = await getParticipantResult(COMPANY, roundOf(m.row.key).id, m.participantId, claims(MGR, m.managerId) as any);
          const c = r.importedComments;
          assert.ok(c, "comments missing for the manager");
          const expectHidden = m.row.key === "u" && m.breakdownRaters < 3;
          assert.equal(c.hidden, expectHidden, `${m.row.key}:${m.row.name} raters=${m.breakdownRaters}`);
          if (c.hidden) {
            assert.deepEqual(c.texts, [], "held-back texts must not be sent");
            held++;
          } else shown++;
        }
        assert.ok(shown > 0, "no visible case was exercised");
        checks.push({ name: `   (manager view: ${shown} groups shown, ${held} held back)`, ok: true });
      });
      await t("a person with no imported comments still reads fine", async () => {
        const without = roundOf("d").participants.find((p: any) => !matched.some((m) => m.participantId === p.id));
        if (!without) return;
        const r: any = await getParticipantResult(COMPANY, roundOf("d").id, without.id, claims(HR) as any);
        assert.equal(r.importedComments, null);
      });
      g.__tx = undefined;
      throw new Rollback();
    }
    g.__tx = undefined;
  };

  try {
    await real.$transaction(body, { timeout: 180_000, maxWait: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  const mismatchedRaters = matched.filter((m) => m.row.raters !== m.breakdownRaters).map((m) => `${m.row.key}:${m.row.name} file=${m.row.raters} round=${m.breakdownRaters}`);
  const perRound = (k: Key) => ({ people: matched.filter((m) => m.row.key === k).length, comments: matched.filter((m) => m.row.key === k).reduce((a, m) => a + m.row.texts.length, 0) });

  const report = {
    mode: MODE,
    input_hash: fnv(raw),
    rows_in: rows.length,
    comments_in: rows.reduce((a, r) => a + r.texts.length, 0),
    matched: matched.length,
    unmatched: unmatched.length,
    ambiguous: ambiguous.length,
    duplicate_count: duplicateTargets.length,
    already_have_comments: alreadyHas.length,
    null_count: rows.filter((r) => r.texts.length === 0).length,
    to_update: { down: perRound("d"), up: perRound("u") },
    to_insert: 0,
    skipped: unmatched.length + ambiguous.length + duplicateTargets.length + alreadyHas.length,
    unmatched_rows: unmatched,
    ambiguous_rows: ambiguous,
    rater_count_differs_from_round: mismatchedRaters.length,
    rater_count_differences: mismatchedRaters.slice(0, 6),
    held_back_for_managers: matched.filter((m) => m.row.key === "u" && m.breakdownRaters < 3).length,
    sample_diff: matched.slice(0, 3).map((m) => ({ round: ROUNDS[m.row.key].raterType, comments_before: 0, comments_after: m.row.texts.length, raters: m.breakdownRaters })),
    database_unchanged_after_dry_run: MODE === "dry" ? clean : "n/a",
  };
  assert.equal(report.rows_in, matched.length + report.skipped, "rows reconcile");
  console.log(JSON.stringify(report, null, 1));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.err ? "\n      " + c.err : ""}`);
  if (MODE === "apply") console.log("after:", JSON.stringify(after), "before:", JSON.stringify(before));
  await real.$disconnect();
  process.exit(checks.every((c) => c.ok) && (MODE === "apply" || clean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
