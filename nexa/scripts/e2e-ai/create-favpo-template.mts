/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
// Creates, through the app's own services, what is needed to run the next Favpo-style round in GV One:
//   1. the current Favpo form (scale 1-3: one rating question with the five examples, and a free-text suggestion box), published;
//   2. two DRAFT template rounds, one per direction (managers rate staff, staff rate managers), holding the October 2569
//      "who rates whom" lists as hand-set pairs on top of the org-chart matching. Nothing is opened, nobody is notified.
// HR copies a template each month, sets the dates and opens it.
//
//   dry   (default)  everything inside ONE transaction, checked with the app's own readers, then thrown away.
//   apply            the same, committed. Run only after the owner has said yes.
//
// Run:  node scripts/e2e-ai/build.mjs create-favpo-template && node --env-file=.env.local .tmp-e2e/create-favpo-template.cjs <favpo-raters-dir> [dry|apply]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma as real } from "@real/prisma";
import { createForm, publishForm, updateForm } from "@/features/appraisal-form/service";
import { createRound, getRound, updateRound } from "@/features/appraisal-round/service";
import { matchRaters, type RaterType } from "@/features/appraisal-round/rules";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MODE = process.argv[3] === "apply" ? "apply" : "dry";
class Rollback extends Error {}

const FORM_NAME = "แบบประเมิน 2026 New (สเกล 1-3)";
const EXAMPLES = "ตัวอย่าง เช่น 1.ผลงาน – ปริมาณ, คุณภาพ, ตรงเวลา 2.ความรู้/ทักษะ – ความเชี่ยวชาญในงาน, การเรียนรู้ใหม่ 3.พฤติกรรมการทำงาน – วินัย, ความรับผิดชอบ, ความคิดริเริ่ม 4.การทำงานร่วมกับผู้อื่น – การสื่อสาร, ทีมเวิร์ก 5.ทัศนคติ – จริยธรรม, การรับฟังความเห็น";
const ROUNDS = {
  down: { name: "แม่แบบ หัวหน้าประเมินลูกน้อง (รายชื่อจาก Favpo ต.ค. 2569)", raterType: "MANAGER" as RaterType },
  up: { name: "แม่แบบ ลูกน้องประเมินหัวหน้า (รายชื่อจาก Favpo ต.ค. 2569)", raterType: "SUBORDINATE" as RaterType },
};
type Key = keyof typeof ROUNDS;
const norm = (s: string) => s.replace(/[\s​ ]+/g, "");

(async () => {
  const dir = process.argv[2]!;
  const names: string[] = JSON.parse(readFileSync(join(dir, "names.json"), "utf8")).names;
  const raw = (key: Key) =>
    readFileSync(join(dir, `${key}.txt`), "utf8")
      .trim()
      .split(";")
      .filter(Boolean)
      .map((x) => {
        const [a, b] = x.split(",");
        return { ratee: names[parseInt(a!, 36)]!, rater: names[parseInt(b!, 36)]! };
      });

  const emps = await real.employee.findMany({ where: { companyId: COMPANY, deletedAt: null }, select: { id: true, firstName: true, lastName: true, nickname: true, managerId: true, status: true } });
  const find = (name: string) => {
    let c = emps.filter((e) => norm(`${e.firstName}${e.lastName ?? ""}`) === norm(name));
    if (c.length === 0) c = emps.filter((e) => norm(e.firstName) === norm(name) || (e.nickname && norm(e.nickname) === norm(name) && !e.lastName));
    return c;
  };
  const people = emps.map((e) => ({ id: e.id, managerId: e.managerId, active: e.status === "ACTIVE" }));

  // The wanted pairs per direction, and who is skipped because a name does not match exactly one employee.
  const skipped: string[] = [];
  const want = {} as Record<Key, { participantId: string; raterId: string; raterType: RaterType }[]>;
  for (const key of ["down", "up"] as Key[]) {
    const seen = new Set<string>();
    want[key] = [];
    for (const r of raw(key)) {
      const a = find(r.ratee);
      const b = find(r.rater);
      if (a.length !== 1 || b.length !== 1) {
        skipped.push(`${key}: ${r.rater} -> ${r.ratee}`);
        continue;
      }
      // A template is for the next round: someone who has left is not rated and does not rate.
      if (a[0]!.status !== "ACTIVE" || b[0]!.status !== "ACTIVE") {
        skipped.push(`${key}: ${r.rater} -> ${r.ratee} (ลาออกแล้ว)`);
        continue;
      }
      const k = `${a[0]!.id}|${b[0]!.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      want[key].push({ participantId: a[0]!.id, raterId: b[0]!.id, raterType: ROUNDS[key].raterType });
    }
  }

  const snapshot = async () => ({
    forms: await real.appraisalForm.count(),
    formQuestions: await real.appraisalQuestion.count(),
    rounds: await real.appraisalRound.count(),
    participants: await real.appraisalParticipant.count(),
    assignments: await real.appraisalAssignment.count(),
    notifications: await real.notification.count(),
    audit: await real.auditLog.count(),
  });
  const before = await snapshot();
  const existing = await real.appraisalForm.count({ where: { companyId: COMPANY, deletedAt: null, name: FORM_NAME } });
  assert.equal(existing, 0, "the form is already created");

  const checks: { name: string; ok: boolean; err?: string }[] = [];
  const t = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e: any) {
      checks.push({ name, ok: false, err: String(e?.message ?? e).split("\n").slice(0, 4).join(" | ") });
    }
  };
  const out: any = { form: null, rounds: {} };

  const body = async (tx: any) => {
    g.__tx = tx;
    const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
    const session = { sub: actor, companyId: COMPANY, email: null, username: "hr.template", roles: [], perms: ["campaign:update", "campaign:manage", "campaign:read", "appraisal-form:update"] } as any;

    const created = await createForm(COMPANY, session, { name: FORM_NAME, description: "ฟอร์มที่ Favpo ใช้ในรอบประเมินปี 2569 สเกล 1-3: คะแนนประสิทธิภาพการทำงานหนึ่งข้อ และช่องข้อเสนอแนะเพื่อพัฒนาและปรับปรุง" });
    await updateForm(COMPANY, session, created.id, {
      ratingMax: 3,
      ratingLabels: [{ score: 1, label: "ปรับปรุง" }, { score: 2, label: "พอใช้" }, { score: 3, label: "ดี" }],
      noteAtLowest: false,
      questions: [
        { text: "ประเมินประสิทธิภาพการทำงาน", helpText: EXAMPLES, answerType: "RATING", weight: 1, required: true, visibleTo: [] },
        { text: "ข้อเสนอแนะเพื่อพัฒนาและปรับปรุง", helpText: null, answerType: "PARAGRAPH", weight: 1, required: false, visibleTo: [] },
      ],
    } as any);
    await publishForm(COMPANY, session, created.id);
    out.form = created.id;

    for (const key of ["down", "up"] as Key[]) {
      const round = await createRound(COMPANY, session, ROUNDS[key].name);
      const participantIds = [...new Set(want[key].map((p) => p.participantId))];
      const orgMatches = matchRaters(participantIds, people, [ROUNDS[key].raterType]).matches;
      const wantKeys = new Set(want[key].map((m) => `${m.participantId}|${m.raterId}|${m.raterType}`));
      const orgKeys = new Set(orgMatches.map((m) => `${m.participantId}|${m.raterId}|${m.raterType}`));
      const add = want[key].filter((m) => !orgKeys.has(`${m.participantId}|${m.raterId}|${m.raterType}`));
      const remove = orgMatches.filter((m) => !wantKeys.has(`${m.participantId}|${m.raterId}|${m.raterType}`));
      await updateRound(COMPANY, session, round.id, {
        raterTypes: [ROUNDS[key].raterType],
        perspectiveWeights: { [ROUNDS[key].raterType]: 100 },
        participantIds,
        remind: false,
        notifyLine: false,
        raterPairs: { add, remove },
      } as any);
      out.rounds[key] = { id: round.id, participants: participantIds.length, wanted: want[key].length, orgMatched: orgMatches.length, add: add.length, remove: remove.length };
    }

    if (MODE === "dry") {
      await t("the form is published with the rating question and the suggestion box, scale 1-3", async () => {
        const f = await tx.appraisalForm.findUnique({ where: { id: out.form }, include: { questions: { orderBy: { order: "asc" } } } });
        assert.equal(f.status, "PUBLISHED");
        assert.equal(f.ratingMax, 3);
        assert.deepEqual(f.questions.map((q: any) => [q.answerType, q.required]), [["RATING", true], ["PARAGRAPH", false]]);
      });
      for (const key of ["down", "up"] as Key[]) {
        await t(`${key}: the round's matching equals the Favpo list exactly`, async () => {
          const r: any = await getRound(COMPANY, out.rounds[key].id);
          assert.equal(r.status, "DRAFT");
          const got = new Set<string>();
          for (const row of r.rows ?? r.matching?.rows ?? []) for (const m of row.raters) got.add(`${row.employeeId}|${m.id}|${m.type}`);
          const wantSet = new Set(want[key].map((m) => `${m.participantId}|${m.raterId}|${m.raterType}`));
          const nameOfId = (id: string) => { const e = emps.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName ?? ""}(${e.status})` : id; };
          const missing = [...wantSet].filter((k) => !got.has(k)).map((k) => k.split("|").slice(0, 2).map(nameOfId).join(" <- "));
          out.rounds[key].missing = missing;
          out.rounds[key].ignored = r.matching.manual.ignored;
          assert.deepEqual(missing, [], "pairs the round does not hold");
          for (const k of got) assert.ok(wantSet.has(k), `extra pair ${k}`);
          assert.equal(r.matching.assignmentCount, wantSet.size, `assignments ${r.matching.assignmentCount} vs wanted ${wantSet.size}`);
          out.rounds[key].exceptions = r.matching.exceptions.length;
          out.rounds[key].manual = r.matching.manual;
        });
      }
      await t("nothing is opened, no sheet exists and nobody is notified", async () => {
        assert.equal(await tx.appraisalAssignment.count(), before.assignments);
        assert.equal(await tx.notification.count(), before.notifications);
        assert.equal(await tx.appraisalRound.count({ where: { name: { in: [ROUNDS.down.name, ROUNDS.up.name] }, status: { not: "DRAFT" } } }), 0);
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
  const rowsIn = raw("down").length + raw("up").length;
  const pairs = want.down.length + want.up.length;
  const report = {
    mode: MODE,
    rows_in: rowsIn,
    matched: pairs,
    to_insert: { form: 1, form_questions: 2, rounds: 2, participants_in_templates: out.rounds.down?.participants + out.rounds.up?.participants, pairs },
    to_update: 0,
    skipped: skipped.length,
    skipped_rows: skipped,
    null_count: 0,
    duplicate_count: rowsIn - skipped.length - pairs,
    rounds: out.rounds,
    sample_diff: want.down.slice(0, 2).concat(want.up.slice(0, 1)).map((m) => ({ type: m.raterType, forms_before: 0, pair_in_template: true })),
    database_unchanged_after_dry_run: MODE === "dry" ? clean : "n/a",
  };
  console.log(JSON.stringify(report, null, 1));
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.err ? "\n      " + c.err : ""}`);
  if (MODE === "apply") console.log("after:", JSON.stringify(after), "before:", JSON.stringify(before));
  await real.$disconnect();
  process.exit(checks.every((c) => c.ok) && (MODE === "apply" || clean) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
