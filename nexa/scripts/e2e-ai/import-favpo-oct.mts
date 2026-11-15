/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
// One-off import of the two October 2569 rounds from Favpo (rated 2-8 Nov 2026) into GV One.
//
//   dry   (default)  does everything inside ONE transaction, checks the result with the app's own services, then throws the
//                    transaction away. Nothing is kept. Prints the standard DryRun report.
//   apply            the same writes, committed. Run only after the owner has said yes to the DryRun report.
//
// Run:  node scripts/e2e-ai/build.mjs import-favpo-oct && node --env-file=.env.local .tmp-e2e/import-favpo-oct.cjs <favpo-oct.txt> [dry|apply]
// Input lines:  favpoCode|name|managerScores|subordinateScores   (scores are one digit each, "-" = none)
//
// What is copied: per person, the average of the raters' scores (Favpo scale 1-3) as a percentage. Not copied: who rated, typed comments.
// Favpo's detail report does not say which rater gave which score, so no rater is attached and no per-rater answer is invented.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma as real } from "@real/prisma";
import { calculateRound, getRoundResults, listMyResults } from "@/features/appraisal-round/results-service";
import { listRounds } from "@/features/appraisal-round/service";
import { getRoundReview } from "@/features/appraisal-round/review-service";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MODE = process.argv[3] === "apply" ? "apply" : "dry";
class Rollback extends Error {}

const SCALE = 3;
const FORM_NAME = "แบบประเมิน 2026 New (นำเข้าจาก Favpo)";
const QUESTION = "ประเมินประสิทธิภาพการทำงาน";
const EXAMPLES = "ตัวอย่าง เช่น 1.ผลงาน – ปริมาณ, คุณภาพ, ตรงเวลา 2.ความรู้/ทักษะ – ความเชี่ยวชาญในงาน, การเรียนรู้ใหม่ 3.พฤติกรรมการทำงาน – วินัย, ความรับผิดชอบ, ความคิดริเริ่ม 4.การทำงานร่วมกับผู้อื่น – การสื่อสาร, ทีมเวิร์ก 5.ทัศนคติ – จริยธรรม, การรับฟังความเห็น";
const ROUNDS = [
  { key: "down", name: "ตุลาคม 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", raterType: "MANAGER" as const },
  { key: "up", name: "ตุลาคม 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", raterType: "SUBORDINATE" as const },
];
const START = new Date("2026-11-02T00:00:00.000Z");
const END = new Date("2026-11-08T00:00:00.000Z");

const norm = (s: string) => s.replace(/[\s​ ]+/g, "");
const r2 = (n: number) => Math.round(n * 100) / 100;

type Row = { code: string; name: string; down: number[]; up: number[] };
function parse(path: string): Row[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const [code, name, d, u] = l.split("|");
      const digits = (s: string | undefined) => (!s || s === "-" ? [] : [...s].map(Number));
      return { code: code!, name: name!, down: digits(d), up: digits(u) };
    });
}

(async () => {
  const rows = parse(process.argv[2]!);
  const emps = await real.employee.findMany({
    where: { companyId: COMPANY, deletedAt: null },
    select: { id: true, employeeCode: true, firstName: true, lastName: true, nickname: true, status: true, department: { select: { name: true } }, position: { select: { title: true } } },
  });

  // Match by name: Favpo codes do not line up with GV One codes after the 13 Nov renumber.
  const byFull = new Map<string, typeof emps>();
  for (const e of emps) {
    const k = norm(`${e.firstName}${e.lastName ?? ""}`);
    byFull.set(k, [...(byFull.get(k) ?? []), e]);
  }
  const matched = new Map<string, (typeof emps)[number]>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const duplicateTargets: string[] = [];
  for (const r of rows) {
    let cands = byFull.get(norm(r.name)) ?? [];
    if (cands.length === 0) cands = emps.filter((e) => norm(e.firstName) === norm(r.name) || (e.nickname && norm(e.nickname) === norm(r.name) && !e.lastName));
    if (cands.length === 0) unmatched.push(r.code);
    else if (cands.length > 1) ambiguous.push(r.code);
    else if ([...matched.values()].some((m) => m.id === cands[0]!.id)) duplicateTargets.push(r.code);
    else matched.set(r.code, cands[0]!);
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const plan = ROUNDS.map((rd) => {
    const people = rows
      .filter((r) => r[rd.key as "down" | "up"].length > 0 && matched.has(r.code))
      .map((r) => {
        const scores = r[rd.key as "down" | "up"];
        const avg = mean(scores);
        return { emp: matched.get(r.code)!, code: r.code, raters: scores.length, avg: r2(avg), percent: r2((avg / SCALE) * 100) };
      });
    const skippedNoMatch = rows.filter((r) => r[rd.key as "down" | "up"].length > 0 && !matched.has(r.code)).length;
    return { ...rd, people, skippedNoMatch };
  });
  assert.ok(rows.every((r) => [...r.down, ...r.up].every((s) => s >= 1 && s <= SCALE)), "every score is on the 1-3 scale");

  const snapshot = async () => ({
    forms: await real.appraisalForm.count(),
    rounds: await real.appraisalRound.count(),
    participants: await real.appraisalParticipant.count(),
    assignments: await real.appraisalAssignment.count(),
    audit: await real.auditLog.count(),
  });
  const before = await snapshot();
  const existing = await real.appraisalRound.count({ where: { companyId: COMPANY, deletedAt: null, name: { in: ROUNDS.map((r) => r.name) } } });
  assert.equal(existing, 0, "the October rounds are already imported");

  const checks: { name: string; ok: boolean; err?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e: any) {
      checks.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 4).join(" | ") });
    }
  };
  const created: { roundIds: string[]; formId?: string } = { roundIds: [] };

  const body = async (tx: any) => {
    g.__tx = tx;
    const lineageId = randomUUID();
    const form = await tx.appraisalForm.create({
      data: {
        companyId: COMPANY,
        lineageId,
        version: 1,
        name: FORM_NAME,
        description: "ฟอร์มที่ Favpo ใช้ในรอบประเมินปี 2569 สเกล 1-3 นำเข้าเพื่อเก็บประวัติ ไม่ใช้เปิดรอบใหม่",
        status: "ARCHIVED",
        ratingMax: SCALE,
        ratingLabels: [{ score: 1, label: "ปรับปรุง" }, { score: 2, label: "พอใช้" }, { score: 3, label: "ดี" }],
        publishedAt: new Date(),
        questions: { create: [{ order: 1, text: QUESTION, helpText: EXAMPLES, answerType: "RATING", weight: 1, required: true, visibleTo: [] }] },
      },
      include: { questions: true },
    });
    created.formId = form.id;
    const q = form.questions[0]!;
    const snap = {
      defaultFormId: form.id,
      forms: { [form.id]: { id: form.id, name: form.name, version: 1, ratingMax: SCALE, ratingLabels: form.ratingLabels, noteAtLowest: false, questions: [{ id: q.id, text: q.text, helpText: q.helpText, answerType: "RATING", options: null, weight: 1, required: true, visibleTo: [], levelDescriptions: null, section: null }] } },
    };
    for (const p of plan) {
      const round = await tx.appraisalRound.create({
        data: {
          companyId: COMPANY,
          name: p.name,
          formId: form.id,
          formSnapshot: snap as any,
          raterTypes: [p.raterType],
          perspectiveWeights: { [p.raterType]: 100 },
          startDate: START,
          endDate: END,
          remind: false,
          notifyLine: false,
          status: "CLOSED",
          openedAt: START,
          notifiedAt: START,
          closedAt: END,
        },
      });
      created.roundIds.push(round.id);
      for (const x of p.people) {
        await tx.appraisalParticipant.create({
          data: {
            roundId: round.id,
            employeeId: x.emp.id,
            departmentName: x.emp.department?.name ?? null,
            positionName: x.emp.position?.title ?? null,
            resultStatus: "CALCULATED",
            scorePercent: x.percent,
            overallScore: x.avg,
            grade: null,
            // "source" tells the recalculation to leave this person alone: there are no submitted answers to recalculate from.
            scoreBreakdown: { source: "favpo-import", scorePercent: x.percent, overallScore: x.avg, grade: null, mode: "SIMPLE", types: [{ raterType: p.raterType, raters: x.raters, percent: x.percent, weightUsed: 100 }] },
            calculatedAt: new Date(),
          },
        });
      }
    }
    await tx.auditLog.create({
      data: { companyId: COMPANY, action: "appraisal_round.import_favpo", entity: "AppraisalRound", entityId: created.roundIds[0]!, after: { rounds: created.roundIds, participants: plan.map((p) => p.people.length), source: "Favpo Y2026 October, 2-8 Nov 2026" } as any },
    });

    if (MODE === "dry") {
      const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
      const claims = (perms: string[], employeeId?: string) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.dry", roles: [], perms, employeeId });
      const HR = ["campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
      await t("the standard DryRun counts agree with what was written", async () => {
        for (let i = 0; i < plan.length; i++) {
          const n = await tx.appraisalParticipant.count({ where: { roundId: created.roundIds[i] } });
          assert.equal(n, plan[i]!.people.length);
        }
        assert.equal(await tx.appraisalAssignment.count({ where: { participant: { roundId: { in: created.roundIds } } } }), 0, "no rater is invented");
      });
      await t("recalculating an imported round keeps every imported score", async () => {
        for (let i = 0; i < plan.length; i++) {
          const r = await calculateRound(COMPANY, claims(HR) as any, created.roundIds[i]!);
          assert.equal(r.calculated, 0);
          const rows2 = await tx.appraisalParticipant.findMany({ where: { roundId: created.roundIds[i] } });
          for (const p of rows2) assert.ok(p.scorePercent !== null && p.resultStatus === "CALCULATED", "score kept");
        }
      });
      await t("the rounds list and the results table read the imported rounds without errors", async () => {
        const list: any = await listRounds(COMPANY);
        const found = (Array.isArray(list) ? list : list.data ?? []).filter((r: any) => created.roundIds.includes(r.id));
        assert.equal(found.length, 2);
        for (const id of created.roundIds) {
          const res: any = await getRoundResults(COMPANY, id, claims(HR) as any);
          assert.ok(res);
        }
      });
      await t("the review page reads the imported rounds", async () => {
        for (const id of created.roundIds) {
          const rv: any = await getRoundReview(COMPANY, claims(HR) as any, id);
          assert.ok(rv);
        }
      });
      await t("an employee sees nothing from the import (not published)", async () => {
        const e = plan[0]!.people[0]!.emp.id;
        const mine = await listMyResults(COMPANY, claims(["notification:read"], e) as any);
        assert.equal(mine.filter((m: any) => String(m.roundName).includes("นำเข้าจาก Favpo")).length, 0);
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

  const report = {
    mode: MODE,
    rows_in: rows.length,
    matched: matched.size,
    unmatched: unmatched.length,
    ambiguous: ambiguous.length,
    duplicate_count: duplicateTargets.length,
    null_count: rows.filter((r) => r.down.length === 0 && r.up.length === 0).length,
    to_insert: { form: 1, rounds: 2, participants: plan.map((p) => ({ round: p.name, people: p.people.length, raters_total: p.people.reduce((a, x) => a + x.raters, 0), skipped_no_match: p.skippedNoMatch })) },
    to_update: 0,
    skipped: unmatched.length + ambiguous.length + duplicateTargets.length,
    unmatched_favpo_codes: unmatched,
    ambiguous_favpo_codes: ambiguous,
    duplicate_favpo_codes: duplicateTargets,
    sample_diff: plan.map((p) => ({ round: p.raterType, first3: p.people.slice(0, 3).map((x) => ({ gvCode: x.emp.employeeCode, raters: x.raters, avg: x.avg, percent: x.percent })) })),
    database_unchanged_after_dry_run: MODE === "dry" ? clean : "n/a",
  };
  console.log(JSON.stringify(report, null, 1));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.err ? "\n      " + c.err : ""}`);
  if (MODE === "apply") console.log("after:", JSON.stringify(after), "before:", JSON.stringify(before));
  await real.$disconnect();
  process.exit(checks.every((c) => c.ok) && (MODE === "apply" || clean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
