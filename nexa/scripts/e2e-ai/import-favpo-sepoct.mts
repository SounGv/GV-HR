/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles stand in for Next */
// One-off import from Favpo (read in the owner's logged-in browser, view only):
//   1. the two SEPTEMBER 2569 rounds (rated 1-6 Oct 2026): people, who rated whom, each rater's 1-3 score and date, each rater's own comment;
//   2. each rater's own comment on the two OCTOBER rounds already imported (until now they were kept as one anonymous list per person).
//
//   dry   (default)  does everything inside ONE transaction, checks the result with the app's own services, then throws the
//                    transaction away. Nothing is kept. Prints the standard DryRun report.
//   apply            the same writes, committed. Run only after the owner has said yes to the DryRun report.
//
// Run:  node scripts/e2e-ai/build.mjs import-favpo-sepoct && node --env-file=.env.local .tmp-e2e/import-favpo-sepoct.cjs <dir> [dry|apply]
// Input dir:  names.txt (one Favpo name per line), r2246.txt r2247.txt r2268.txt r2269.txt with lines   rateeIdx|raterIdx|percent|ddmm|comment
//             (indexes are base 36 into names.txt; r2246/r2247 = September manager->staff / staff->manager, r2268/r2269 = the same for October;
//              the October files hold only the lines that have a comment)
//
// What is written: a text question ("ข้อเสนอแนะ...", weight 0, like Favpo's form) on the archived Favpo form and in the October round snapshots;
// for September two CLOSED rounds with one participant per person, one SUBMITTED sheet per rater (score, comment, date given) and the
// average score as a percent (same as the October import); for October each rater's comment on the sheet already there.
// The anonymous per-person comment list of an October person is removed only when every text in it now sits on a rater's sheet.
// Nobody is notified; the imported rounds stay closed and hidden from staff. A person who cannot be matched to exactly one employee is skipped and listed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma as real } from "@real/prisma";
import { calculateRound, getAssignmentForHr, getRoundResults } from "@/features/appraisal-round/results-service";
import { getParticipantResult, getRoundMatrix, listMyAssignments, listRounds } from "@/features/appraisal-round/service";

const g = globalThis as any;
const COMPANY = "00000000-0000-0000-0000-000000000001";
const MODE = process.argv[3] === "apply" ? "apply" : "dry";
class Rollback extends Error {}

const SCALE = 3;
const FORM_NAME = "แบบประเมิน 2026 New (นำเข้าจาก Favpo)";
const PUBLISHED_FORM_NAME = "แบบประเมิน 2026 New (สเกล 1-3)";
const KEYS = {
  sepDown: { file: "r2246.txt", name: "กันยายน 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", raterType: "MANAGER", month: 10 },
  sepUp: { file: "r2247.txt", name: "กันยายน 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", raterType: "SUBORDINATE", month: 10 },
  octDown: { file: "r2268.txt", name: "ตุลาคม 2569 หัวหน้าประเมินลูกน้อง (นำเข้าจาก Favpo)", raterType: "MANAGER", month: 11 },
  octUp: { file: "r2269.txt", name: "ตุลาคม 2569 ลูกน้องประเมินหัวหน้า (นำเข้าจาก Favpo)", raterType: "SUBORDINATE", month: 11 },
} as const;
type Key = keyof typeof KEYS;
const SEP_START = new Date("2026-10-01T00:00:00.000Z");
const SEP_END = new Date("2026-10-06T00:00:00.000Z");

const norm = (s: string) => s.replace(/[\s​ ]+/g, "");
const r2 = (n: number) => Math.round(n * 100) / 100;

type Row = { ratee: string; rater: string; score: number; at: Date; comment: string };
function parse(dir: string, names: string[], key: Key): Row[] {
  return readFileSync(join(dir, KEYS[key].file), "utf8")
    .replace(/\r?\n$/, "")
    .split(/\r?\n/)
    .filter((l) => l.length)
    .map((l) => {
      const [a, b, pct, ddmm, ...rest] = l.split("|");
      const ratee = names[parseInt(a!, 36)]!;
      const rater = names[parseInt(b!, 36)]!;
      assert.ok(ratee && rater, `name index out of range in ${key}: ${l.slice(0, 30)}`);
      assert.ok(["33.33", "66.67", "100"].includes(pct!), `percent not on the 1-3 scale: ${pct}`);
      const score = Math.round((Number(pct) / 100) * SCALE);
      const day = Number(ddmm!.slice(0, 2));
      const month = Number(ddmm!.slice(2));
      // Noon in Bangkok, so the date reads the same in every time zone.
      return { ratee, rater, score, at: new Date(Date.UTC(2026, month - 1, day, 5, 0, 0)), comment: rest.join("|").trim() };
    });
}

(async () => {
  const dir = process.argv[2]!;
  const names = readFileSync(join(dir, "names.txt"), "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
  const rows = Object.fromEntries((Object.keys(KEYS) as Key[]).map((k) => [k, parse(dir, names, k)])) as Record<Key, Row[]>;

  const snapshot = async () => ({
    forms: await real.appraisalForm.count(),
    questions: await real.appraisalQuestion.count(),
    rounds: await real.appraisalRound.count(),
    participants: await real.appraisalParticipant.count(),
    assignments: await real.appraisalAssignment.count(),
    notifications: await real.notification.count(),
    audit: await real.auditLog.count(),
  });
  const before = await snapshot();

  const emps = await real.employee.findMany({
    where: { companyId: COMPANY, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, nickname: true, department: { select: { name: true } }, position: { select: { title: true } } },
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
  const log: Record<string, any> = {};
  const unmatchedNames = new Set<string>();
  const ambiguousNames = new Set<string>();

  const body = async (tx: any) => {
    g.__tx = tx;
    const octNames = [KEYS.octDown.name, KEYS.octUp.name];
    assert.equal(await tx.appraisalRound.count({ where: { companyId: COMPANY, deletedAt: null, name: { in: [KEYS.sepDown.name, KEYS.sepUp.name] } } }), 0, "the September rounds are already imported");

    // ---- the text question: on the archived form, in the October snapshots, and (copied) in the September snapshots
    const form = await tx.appraisalForm.findFirst({ where: { companyId: COMPANY, name: FORM_NAME, deletedAt: null }, include: { questions: { orderBy: { order: "asc" } } } });
    assert.ok(form, "the archived Favpo form is missing");
    const live = await tx.appraisalForm.findFirst({ where: { companyId: COMPANY, name: PUBLISHED_FORM_NAME, deletedAt: null }, include: { questions: { orderBy: { order: "asc" } } } });
    const liveText = live?.questions.find((q: any) => q.answerType === "PARAGRAPH");
    assert.ok(liveText, "the published form's suggestion question is missing (the model for the text question)");
    let textQ = form.questions.find((q: any) => q.answerType === "PARAGRAPH");
    const addedQuestion = !textQ;
    if (!textQ) {
      textQ = await tx.appraisalQuestion.create({ data: { formId: form.id, order: 2, text: liveText.text, helpText: liveText.helpText, answerType: "PARAGRAPH", weight: 0, required: false, visibleTo: [] } });
    }
    const ratingQ = form.questions.find((q: any) => q.answerType === "RATING")!;
    const questionEntry = { id: textQ.id, text: textQ.text, helpText: textQ.helpText, answerType: "PARAGRAPH", options: null, weight: 0, required: false, visibleTo: [], section: null, levelDescriptions: null };

    const octRounds = await tx.appraisalRound.findMany({
      where: { companyId: COMPANY, deletedAt: null, name: { in: octNames } },
      select: {
        id: true, name: true, formSnapshot: true,
        participants: { select: { id: true, importedComments: true, employee: { select: { id: true } }, assignments: { select: { id: true, raterEmployeeId: true, raterType: true, answers: true } } } },
      },
    });
    assert.equal(octRounds.length, 2, "both October rounds must exist");
    let snapshotsUpdated = 0;
    for (const r of octRounds) {
      const snap: any = r.formSnapshot;
      const f = snap.forms[snap.defaultFormId];
      if (!f.questions.some((q: any) => q.id === textQ.id)) {
        f.questions.push(questionEntry);
        await tx.appraisalRound.update({ where: { id: r.id }, data: { formSnapshot: snap } });
        snapshotsUpdated++;
      }
    }
    log.text_question = { added_to_form: addedQuestion, october_snapshots_updated: snapshotsUpdated };
    const baseSnap: any = JSON.parse(JSON.stringify((await tx.appraisalRound.findUnique({ where: { id: octRounds[0]!.id }, select: { formSnapshot: true } })).formSnapshot));
    assert.equal(baseSnap.forms[baseSnap.defaultFormId].questions.length, 2);

    // ---- October: each rater's comment goes onto that rater's sheet
    const octReport: Record<string, any> = {};
    for (const key of ["octDown", "octUp"] as Key[]) {
      const round = octRounds.find((r: any) => r.name === KEYS[key].name)!;
      const rep = { rows_in: rows[key].length, matched: 0, to_update: 0, already_have: 0, no_person: [] as string[], no_sheet: [] as string[], ambiguous: [] as string[] };
      for (const row of rows[key]) {
        const rateeEmp = find(row.ratee);
        const raterEmp = find(row.rater);
        if (rateeEmp.length > 1 || raterEmp.length > 1) { rep.ambiguous.push(`${row.ratee}<-${row.rater}`); if (rateeEmp.length > 1) ambiguousNames.add(row.ratee); if (raterEmp.length > 1) ambiguousNames.add(row.rater); continue; }
        if (rateeEmp.length === 0) { unmatchedNames.add(row.ratee); rep.no_person.push(`ratee ${row.ratee}`); continue; }
        if (raterEmp.length === 0) { unmatchedNames.add(row.rater); rep.no_person.push(`rater ${row.rater}`); continue; }
        const p = round.participants.find((x: any) => x.employee.id === rateeEmp[0]!.id);
        const a = p?.assignments.find((x: any) => x.raterEmployeeId === raterEmp[0]!.id && x.raterType === KEYS[key].raterType);
        if (!p || !a) { rep.no_sheet.push(`${row.ratee}<-${row.rater}`); continue; }
        rep.matched++;
        const answers: any[] = Array.isArray(a.answers) ? a.answers : [];
        if (answers.some((x) => x.questionId === textQ.id)) { rep.already_have++; continue; }
        await tx.appraisalAssignment.update({ where: { id: a.id }, data: { answers: [...answers, { questionId: textQ.id, value: row.comment }] as any } });
        a.answers = [...answers, { questionId: textQ.id, value: row.comment }];
        rep.to_update++;
      }
      octReport[key] = { ...rep, no_person: rep.no_person.length, no_sheet: rep.no_sheet.length, ambiguous: rep.ambiguous.length, no_sheet_detail: rep.no_sheet };
    }
    log.october = octReport;

    // ---- October: drop the anonymous per-person list when every text in it is now on a sheet
    let cleared = 0, kept = 0;
    const keptDetail: string[] = [];
    for (const r of octRounds) {
      for (const p of r.participants) {
        const ic: any = p.importedComments;
        if (!ic) continue;
        const onSheets: string[] = p.assignments.flatMap((a: any) => (Array.isArray(a.answers) ? a.answers : []).filter((x: any) => x.questionId === textQ.id && x.value).map((x: any) => String(x.value)));
        const pool = [...onSheets];
        const allThere = (ic.texts as string[]).every((txt) => { const i = pool.indexOf(txt); if (i < 0) return false; pool.splice(i, 1); return true; });
        if (allThere) {
          await tx.appraisalParticipant.update({ where: { id: p.id }, data: { importedComments: null } });
          cleared++;
        } else {
          kept++;
          keptDetail.push(`${(ic.texts as string[]).length} in the list, ${onSheets.length} on sheets`);
        }
      }
    }
    log.october_anonymous_lists = { cleared, kept, kept_detail: keptDetail };

    // ---- September: rounds, people, sheets
    const sepReport: Record<string, any> = {};
    const sepRoundIds: string[] = [];
    const sepPlan: { key: Key; roundId: string; participants: number; sheets: number; texts: number }[] = [];
    for (const key of ["sepDown", "sepUp"] as Key[]) {
      const k = KEYS[key];
      const round = await tx.appraisalRound.create({
        data: {
          companyId: COMPANY, name: k.name, formId: form.id, formSnapshot: baseSnap, raterTypes: [k.raterType], perspectiveWeights: { [k.raterType]: 100 },
          startDate: SEP_START, endDate: SEP_END, remind: false, notifyLine: false, status: "CLOSED", openedAt: SEP_START, notifiedAt: SEP_START, closedAt: SEP_END,
        },
      });
      sepRoundIds.push(round.id);
      const byRatee = new Map<string, Row[]>();
      for (const row of rows[key]) byRatee.set(row.ratee, [...(byRatee.get(row.ratee) ?? []), row]);
      const rep = { rows_in: rows[key].length, people_in: byRatee.size, to_insert_people: 0, to_insert_sheets: 0, with_comment: 0, skipped_people: [] as string[], skipped_raters: [] as string[], duplicates: 0, dates: new Set<string>() as any };
      const seenPerson = new Set<string>();
      for (const [rateeName, rs] of byRatee) {
        const rateeEmp = find(rateeName);
        if (rateeEmp.length !== 1) {
          (rateeEmp.length === 0 ? unmatchedNames : ambiguousNames).add(rateeName);
          rep.skipped_people.push(rateeEmp.length === 0 ? "no match" : "ambiguous");
          continue;
        }
        const emp = rateeEmp[0]!;
        assert.ok(!seenPerson.has(emp.id), "two Favpo people matched the same employee");
        seenPerson.add(emp.id);
        // The person's score is the mean over every rater Favpo has, including a rater we cannot match, so it equals Favpo's number.
        const avg = rs.reduce((a, x) => a + x.score, 0) / rs.length;
        const percent = r2((avg / SCALE) * 100);
        const part = await tx.appraisalParticipant.create({
          data: {
            roundId: round.id, employeeId: emp.id, departmentName: emp.department?.name ?? null, positionName: emp.position?.title ?? null,
            resultStatus: "PUBLISHED", scorePercent: percent, overallScore: r2(avg), grade: null, calculatedAt: new Date(), publishedAt: new Date(),
            scoreBreakdown: { source: "favpo-import", scorePercent: percent, overallScore: r2(avg), grade: null, mode: "SIMPLE", types: [{ raterType: k.raterType, raters: rs.length, percent, weightUsed: 100 }] },
          },
        });
        rep.to_insert_people++;
        const seenRater = new Set<string>();
        for (const row of rs) {
          const raterEmp = find(row.rater);
          if (raterEmp.length !== 1) { (raterEmp.length === 0 ? unmatchedNames : ambiguousNames).add(row.rater); rep.skipped_raters.push(`${raterEmp.length === 0 ? "no match" : "ambiguous"}`); continue; }
          if (seenRater.has(raterEmp[0]!.id)) { rep.duplicates++; continue; }
          seenRater.add(raterEmp[0]!.id);
          const answers: any[] = [{ questionId: ratingQ.id, value: row.score }];
          if (row.comment) { answers.push({ questionId: textQ.id, value: row.comment }); rep.with_comment++; }
          await tx.appraisalAssignment.create({ data: { participantId: part.id, raterEmployeeId: raterEmp[0]!.id, raterType: k.raterType, status: "SUBMITTED", answers: answers as any, startedAt: row.at, submittedAt: row.at } });
          rep.to_insert_sheets++;
          rep.dates.add(row.at.toISOString().slice(0, 10));
        }
      }
      sepReport[key] = { ...rep, skipped_people: rep.skipped_people.length, skipped_raters: rep.skipped_raters.length, dates: [...rep.dates].sort().join(",") };
      sepPlan.push({ key, roundId: round.id, participants: rep.to_insert_people, sheets: rep.to_insert_sheets, texts: rep.with_comment });
    }
    log.september = sepReport;
    await tx.auditLog.create({
      data: { companyId: COMPANY, action: "appraisal_round.import_favpo_sepoct", entity: "AppraisalRound", entityId: sepRoundIds[0]!, after: { rounds: sepRoundIds, sheets: sepPlan.map((p) => p.sheets), source: "Favpo Y2026 September and October comments" } as any },
    });

    // ---- checks with the app's own services (dry run only)
    const actor = (await tx.user.findFirst({ where: { companyId: COMPANY }, select: { id: true } }))!.id;
    const claims = (perms: string[], employeeId?: string) => ({ sub: actor, companyId: COMPANY, email: null, username: "hr.dry", roles: [], perms, employeeId });
    const HR = ["campaign:update", "campaign:approve", "campaign:manage", "campaign:read"];
    await t("every imported sheet is submitted and no one was notified", async () => {
      assert.equal(await tx.appraisalAssignment.count({ where: { status: { not: "SUBMITTED" }, participant: { roundId: { in: sepRoundIds } } } }), 0);
      assert.equal(await tx.notification.count(), before.notifications);
    });
    await t("recalculating the imported rounds keeps every score", async () => {
      for (const id of [...sepRoundIds, ...octRounds.map((r: any) => r.id)]) {
        const b = await tx.appraisalParticipant.findMany({ where: { roundId: id }, select: { id: true, scorePercent: true, resultStatus: true }, orderBy: { id: "asc" } });
        await calculateRound(COMPANY, claims(HR) as any, id);
        const a = await tx.appraisalParticipant.findMany({ where: { roundId: id }, select: { id: true, scorePercent: true, resultStatus: true }, orderBy: { id: "asc" } });
        assert.deepEqual(a, b);
      }
    });
    await t("a September person's page shows the rater group, with the written comments in HR's view", async () => {
      const plan = sepPlan[0]!;
      const people = await tx.appraisalParticipant.findMany({ where: { roundId: plan.roundId }, select: { id: true, assignments: { select: { answers: true } } } });
      const withComment = people.find((x: any) => x.assignments.some((a: any) => (a.answers ?? []).some((v: any) => v.questionId === textQ.id && v.value)));
      assert.ok(withComment, "no September person has a written comment");
      const res: any = await getParticipantResult(COMPANY, plan.roundId, withComment!.id, claims(HR) as any);
      const grp = res.groups.find((x: any) => x.raterType === "MANAGER");
      assert.ok(grp && grp.submitted > 0);
      const wrote = withComment!.assignments.flatMap((a: any) => a.answers).filter((x: any) => x.questionId === textQ.id && x.value).length;
      const shown = grp.summary.filter((s: any) => s.answerType !== "RATING").flatMap((s: any) => s.texts ?? s.answers ?? []).length;
      assert.ok(wrote === 0 || shown >= 1, `HR sees ${shown} of ${wrote} written comments`);
    });
    await t("an October person's page still shows the comments (now from the sheets) and the anonymous list is gone for them", async () => {
      const p = octRounds[0]!.participants.find((x: any) => x.assignments.some((a: any) => (a.answers ?? []).some((v: any) => v.questionId === textQ.id)))!;
      const res: any = await getParticipantResult(COMPANY, octRounds[0]!.id, p.id, claims(HR) as any);
      const grp = res.groups.find((x: any) => x.raterType === "MANAGER");
      assert.ok(grp && grp.summary.some((s: any) => s.answerType !== "RATING"));
    });
    await t("the HR sheet view of one rater shows that rater's own comment", async () => {
      const a = octRounds[0]!.participants.flatMap((x: any) => x.assignments.map((s: any) => ({ round: octRounds[0]!.id, id: s.id, answers: s.answers }))).find((s: any) => (s.answers ?? []).some((v: any) => v.questionId === textQ.id))!;
      const sheet: any = await getAssignmentForHr(COMPANY, a.round, a.id);
      const txt = JSON.stringify(sheet);
      const want = String(a.answers.find((v: any) => v.questionId === textQ.id).value);
      assert.ok(txt.includes(want.slice(0, 20)), "comment missing from the HR sheet");
    });
    await t("the tracking matrix and the results table read the new rounds, and staff see none of the sheets", async () => {
      for (const id of sepRoundIds) {
        const m: any = await getRoundMatrix(COMPANY, id, claims(HR) as any);
        assert.ok((m.data ?? m).length > 0);
        assert.ok(await getRoundResults(COMPANY, id, claims(HR) as any));
      }
      const list: any = await listRounds(COMPANY);
      assert.ok(list.filter((r: any) => String(r.name).startsWith("กันยายน 2569")).length === 2);
      const raters = await tx.appraisalAssignment.findMany({ where: { participant: { roundId: { in: sepRoundIds } } }, select: { raterEmployeeId: true }, distinct: ["raterEmployeeId"] });
      for (const r of raters.slice(0, 20)) {
        const mine: any[] = await listMyAssignments(COMPANY, { ...claims(["notification:read"]), employeeId: r.raterEmployeeId } as any);
        assert.equal(mine.filter((m) => String(m.roundName).includes("นำเข้าจาก Favpo")).length, 0);
      }
    });
    log.checks_in_transaction = checks;
    if (MODE === "dry") {
      g.__tx = undefined;
      throw new Rollback();
    }
    g.__tx = undefined;
  };

  try {
    await real.$transaction(body, { timeout: 280_000, maxWait: 30_000 });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const after = await snapshot();
  const clean = JSON.stringify(before) === JSON.stringify(after);
  const passed = checks.filter((c) => c.ok).length;
  console.log(JSON.stringify({ mode: MODE, ...log, unmatched_names: unmatchedNames.size, ambiguous_names: ambiguousNames.size, checks: { passed, failed: checks.length - passed, failures: checks.filter((c) => !c.ok) }, database_unchanged_after_dry_run: MODE === "dry" ? clean : null, counts_before: before, counts_after: after }, null, 1));
  await real.$disconnect();
  process.exit(MODE === "dry" ? (clean && checks.every((c) => c.ok) ? 0 : 1) : checks.every((c) => c.ok) ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
