/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
// One-off import of WHO rated WHOM, and each rater's score, for the two October 2569 Favpo rounds already in GV One.
//
//   dry   (default)  writes inside ONE transaction, checks the result with the app's own services, then throws the transaction
//                    away. Nothing is kept. Prints the standard DryRun report.
//   apply            the same writes, committed. Run only after the owner has said yes to the DryRun report.
//
// Run:  node scripts/e2e-ai/build.mjs import-favpo-raters && node --env-file=.env.local .tmp-e2e/import-favpo-raters.cjs <favpo-raters-dir> [dry|apply]
// Input dir:  names.json {names:[...]}, down.txt and up.txt with entries  rateeIdx,raterIdx,percent,ddmm,;   (indexes are base 36 into names)
//
// What is added: one SUBMITTED answer sheet per rater and person, with the 1-3 score Favpo recorded and the date it was given.
// What is not touched: the scores already on the people (the import keeps them; this only has to agree with them), the comments,
// and nobody is notified. A rater who cannot be matched to exactly one employee is skipped and listed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma as real } from "@real/prisma";
import { calculateRound, getRoundResults } from "@/features/appraisal-round/results-service";
import { getParticipantResult, getRoundMatrix, listMyAssignments } from "@/features/appraisal-round/service";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MODE = process.argv[3] === "apply" ? "apply" : "dry";
class Rollback extends Error {}

const ROUNDS = {
  down: { name: "ตุลาคม 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", raterType: "MANAGER" },
  up: { name: "ตุลาคม 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", raterType: "SUBORDINATE" },
} as const;
type Key = keyof typeof ROUNDS;
const SCALE = 3;
const norm = (s: string) => s.replace(/[\s​ ]+/g, "");

type Entry = { ratee: string; rater: string; score: number; at: Date };
function parse(dir: string, names: string[], key: Key): Entry[] {
  return readFileSync(join(dir, `${key}.txt`), "utf8")
    .trim()
    .split(";")
    .filter(Boolean)
    .map((x) => {
      const [a, b, pct, ddmm] = x.split(",");
      const ratee = names[parseInt(a!, 36)]!;
      const rater = names[parseInt(b!, 36)]!;
      assert.ok(ratee && rater, `name index out of range in ${key}: ${x}`);
      const score = Math.round((Number(pct) / 100) * SCALE);
      assert.ok(score >= 1 && score <= SCALE, `score out of range: ${x}`);
      const day = Number(ddmm!.slice(0, 2));
      const month = Number(ddmm!.slice(2));
      // Noon in Bangkok, so the date reads the same in every time zone.
      return { ratee, rater, score, at: new Date(Date.UTC(2026, month - 1, day, 5, 0, 0)) };
    });
}

(async () => {
  const dir = process.argv[2]!;
  const names: string[] = JSON.parse(readFileSync(join(dir, "names.json"), "utf8")).names;
  const entries = { down: parse(dir, names, "down"), up: parse(dir, names, "up") };

  const snapshot = async () => ({
    participants: await real.appraisalParticipant.count(),
    assignments: await real.appraisalAssignment.count(),
    rounds: await real.appraisalRound.count(),
    audit: await real.auditLog.count(),
  });
  const before = await snapshot();

  const emps = await real.employee.findMany({
    where: { companyId: COMPANY, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, nickname: true },
  });
  const find = (name: string) => {
    let c = emps.filter((e) => norm(`${e.firstName}${e.lastName ?? ""}`) === norm(name));
    if (c.length === 0) c = emps.filter((e) => norm(e.firstName) === norm(name) || (e.nickname && norm(e.nickname) === norm(name) && !e.lastName));
    return c;
  };

  const checks: { name: string; ok: boolean; err?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e: any) {
      checks.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 4).join(" | ") });
    }
  };

  type Plan = { key: Key; participantId: string; roundId: string; raterId: string; raterName: string; score: number; at: Date };
  const plan: Plan[] = [];
  const skippedRater: string[] = [];
  const skippedRatee: string[] = [];
  const skippedAmbiguous: string[] = [];
  const skippedExisting: string[] = [];
  const mismatches: string[] = [];
  const novDateAfterClose: number[] = [];

  const body = async (tx: any) => {
    g.__tx = tx;
    const rounds = await tx.appraisalRound.findMany({
      where: { companyId: COMPANY, deletedAt: null, name: { in: [ROUNDS.down.name, ROUNDS.up.name] } },
      select: {
        id: true,
        name: true,
        endDate: true,
        formSnapshot: true,
        participants: { select: { id: true, scorePercent: true, scoreBreakdown: true, employee: { select: { id: true, firstName: true, lastName: true, nickname: true } }, _count: { select: { assignments: true } } } },
      },
    });
    assert.equal(rounds.length, 2, "both imported October rounds must exist");
    const questionOf = new Map<string, string>();

    for (const key of ["down", "up"] as Key[]) {
      const round = rounds.find((r: any) => r.name === ROUNDS[key].name)!;
      const snap = round.formSnapshot as any;
      const q = snap.forms[snap.defaultFormId].questions[0];
      assert.equal(q.answerType, "RATING");
      questionOf.set(key, q.id);
      const seen = new Set<string>();
      for (const e of entries[key]) {
        const rateeEmp = find(e.ratee);
        const participant = rateeEmp.length === 1 ? round.participants.find((p: any) => p.employee.id === rateeEmp[0]!.id) : undefined;
        if (rateeEmp.length > 1) {
          skippedAmbiguous.push(`${key}:ratee ${e.ratee}`);
          continue;
        }
        if (!participant) {
          skippedRatee.push(`${key}:${e.ratee}`);
          continue;
        }
        const raterEmp = find(e.rater);
        if (raterEmp.length === 0) {
          skippedRater.push(`${key}:${e.rater} (rated ${e.ratee})`);
          continue;
        }
        if (raterEmp.length > 1) {
          skippedAmbiguous.push(`${key}:rater ${e.rater}`);
          continue;
        }
        if (participant._count.assignments > 0) {
          skippedExisting.push(`${key}:${e.ratee}`);
          continue;
        }
        const dupKey = `${participant.id}|${raterEmp[0]!.id}`;
        if (seen.has(dupKey)) {
          skippedAmbiguous.push(`${key}:duplicate ${e.rater} -> ${e.ratee}`);
          continue;
        }
        seen.add(dupKey);
        if (round.endDate && e.at.getTime() > new Date(round.endDate).getTime() + 24 * 3600 * 1000) novDateAfterClose.push(1);
        plan.push({ key, participantId: participant.id, roundId: round.id, raterId: raterEmp[0]!.id, raterName: e.rater, score: e.score, at: e.at });
      }
      // The sheets must agree with what the people already carry: the same number of raters and the same average.
      for (const p of round.participants) {
        const mine = plan.filter((x) => x.participantId === p.id);
        if (mine.length === 0) continue;
        const pct = (mine.reduce((a, x) => a + x.score, 0) / mine.length / SCALE) * 100;
        const raters = (p.scoreBreakdown as any)?.types?.[0]?.raters;
        if (Math.abs(pct - (p.scorePercent ?? -1)) > 0.01 || raters !== mine.length) mismatches.push(`${key}:${p.employee.firstName} sheets=${mine.length} avg=${pct.toFixed(2)} stored=${raters}/${p.scorePercent}`);
      }
    }

    for (const x of plan) {
      await tx.appraisalAssignment.create({
        data: {
          participantId: x.participantId,
          raterEmployeeId: x.raterId,
          raterType: ROUNDS[x.key].raterType,
          status: "SUBMITTED",
          answers: [{ questionId: questionOf.get(x.key)!, value: x.score }] as any,
          startedAt: x.at,
          submittedAt: x.at,
        },
      });
    }
    await tx.auditLog.create({
      data: { companyId: COMPANY, action: "appraisal_round.import_favpo_raters", entity: "AppraisalRound", entityId: rounds[0].id, after: { rounds: rounds.map((r: any) => r.id), sheets: plan.length, source: "Favpo Y2026 October" } as any },
    });

    if (MODE === "dry") {
      const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
      const claims = (perms: string[]) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.dry", roles: [], perms });
      const HR = ["campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
      await t("the sheets written agree with the report and nobody was notified", async () => {
        assert.equal(await tx.appraisalAssignment.count(), before.assignments + plan.length);
        assert.equal(await tx.appraisalAssignment.count({ where: { status: { not: "SUBMITTED" }, participant: { roundId: { in: rounds.map((r: any) => r.id) } } } }), 0, "every imported sheet is submitted");
        assert.equal(await tx.notification.count({ where: { createdAt: { gte: new Date(Date.now() - 120_000) }, title: { contains: "นำเข้าจาก Favpo" } } }), 0);
      });
      await t("recalculating keeps every imported score (the sheets agree with them, nothing is replaced)", async () => {
        for (const r of rounds) {
          const before2 = await tx.appraisalParticipant.findMany({ where: { roundId: r.id }, select: { id: true, scorePercent: true } });
          await calculateRound(COMPANY, claims(HR) as any, r.id);
          const after2 = await tx.appraisalParticipant.findMany({ where: { roundId: r.id }, select: { id: true, scorePercent: true } });
          assert.deepEqual(after2.sort((a: any, b: any) => a.id.localeCompare(b.id)), before2.sort((a: any, b: any) => a.id.localeCompare(b.id)));
        }
      });
      await t("the person page shows the rater group with its score counts, and the tracking matrix lists the raters as done", async () => {
        const first = plan[0]!;
        const res: any = await getParticipantResult(COMPANY, first.roundId, first.participantId, claims(HR) as any);
        const grp = res.groups.find((x: any) => x.raterType === ROUNDS[first.key].raterType);
        assert.ok(grp && grp.submitted === plan.filter((x) => x.participantId === first.participantId).length);
        const matrix: any = await getRoundMatrix(COMPANY, first.roundId, claims(HR) as any);
        const row = (matrix.data ?? matrix).find((m: any) => m.participantId === first.participantId);
        assert.ok(row && row.assignments.every((a: any) => a.status === "SUBMITTED"));
      });
      await t("a rater's own list does not show the copied sheets, and every rater who has some is checked", async () => {
        const ids = [...new Set(plan.map((x) => x.raterId))];
        for (const id of ids) {
          const mine: any[] = await listMyAssignments(COMPANY, { ...claims(["notification:read"]), employeeId: id } as any);
          assert.equal(mine.filter((m) => String(m.roundName).includes("นำเข้าจาก Favpo")).length, 0);
        }
      });
      await t("the results table still reads both rounds", async () => {
        for (const r of rounds) assert.ok(await getRoundResults(COMPANY, r.id, claims(HR) as any));
      });
      g.__tx = undefined;
      throw new Rollback();
    }
    g.__tx = undefined;
  };

  try {
    await real.$transaction(body, { timeout: 240_000, maxWait: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  const rowsIn = entries.down.length + entries.up.length;
  const skipped = skippedRater.length + skippedRatee.length + skippedAmbiguous.length + skippedExisting.length;
  const per = (k: Key) => plan.filter((x) => x.key === k).length;

  const report = {
    mode: MODE,
    rows_in: rowsIn,
    matched: plan.length,
    to_insert: { sheets: plan.length, down: per("down"), up: per("up"), distinct_raters: new Set(plan.map((x) => x.raterId)).size, distinct_people: new Set(plan.map((x) => x.participantId)).size },
    to_update: 0,
    skipped,
    skipped_rater_not_matched: skippedRater,
    skipped_ratee_not_in_round: skippedRatee,
    skipped_ambiguous_or_duplicate: skippedAmbiguous,
    skipped_person_already_has_sheets: skippedExisting,
    null_count: 0,
    duplicate_count: skippedAmbiguous.filter((s) => s.includes("duplicate")).length,
    people_whose_sheets_disagree_with_stored_score: mismatches.length,
    disagreements: mismatches.slice(0, 8),
    dated_after_round_end: novDateAfterClose.length,
    score_mix: { gave_3: plan.filter((x) => x.score === 3).length, gave_2: plan.filter((x) => x.score === 2).length },
    sample_diff: plan.slice(0, 3).map((x) => ({ round: x.key, sheets_before: 0, score: x.score, date: x.at.toISOString().slice(0, 10) })),
    database_unchanged_after_dry_run: MODE === "dry" ? clean : "n/a",
  };
  assert.equal(report.rows_in, report.matched + report.skipped, "rows reconcile");
  console.log(JSON.stringify(report, null, 1));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.err ? "\n      " + c.err : ""}`);
  if (MODE === "apply") console.log("after:", JSON.stringify(after), "before:", JSON.stringify(before));
  await real.$disconnect();
  process.exit(checks.every((c) => c.ok) && (MODE === "apply" || clean) && mismatches.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
