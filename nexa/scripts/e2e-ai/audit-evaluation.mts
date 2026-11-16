/* eslint-disable @typescript-eslint/no-explicit-any -- read-only audit of the evaluation data */
// Read-only. Checks the evaluation system's data end to end: who rates whom (against the org chart and the hand-set pairs), sheet
// states, answers against the frozen form, the stored scores against a fresh recalculation, and the settings that decide scores.
// Prints counts, round names and employee codes only (no names, no comments). Writes nothing and fails if any row count changed.
import { prisma as real } from "@real/prisma";
import { getSettings } from "@/features/appraisal-round/results-service";
import { computeResult, gradeFor } from "@/features/appraisal-round/scoring";
import { PRESET_WEIGHTS, PEER_LIMIT, MAX_LOAD, readOverrides } from "@/features/appraisal-round/rules";

const COMPANY = "00000000-0000-0000-0000-000000000001";
type Line = { ok: boolean; name: string; detail?: string };
const out: Line[] = [];
const add = (ok: boolean, name: string, detail?: string) => out.push({ ok, name, detail });
const list = (xs: string[], n = 8) => (xs.length ? `${xs.slice(0, n).join(", ")}${xs.length > n ? ` (+${xs.length - n})` : ""}` : "none");

(async () => {
  const before = { p: await real.appraisalParticipant.count(), a: await real.appraisalAssignment.count(), r: await real.appraisalRound.count() };
  const settings: any = await getSettings(COMPANY);
  add(true, "E0 (info) settings", `calc=${settings.calcMode} approvalLevels=${settings.approvalLevels} employeeSees=${settings.employeeSees} ackRequired=${settings.ackRequired} bands=${JSON.stringify(settings.bands ?? null)}`);
  const bands = settings.bands as { label: string; minPercent: number }[] | null;
  if (bands) {
    const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
    add(sorted.some((b) => b.minPercent === 0), "E0 grade bands: the lowest band starts at 0 so nobody is left without a grade", `lowest starts at ${sorted[0]?.minPercent}`);
  } else add(true, "E0 (info) no grade bands set, so no grade is shown");

  const emps = await real.employee.findMany({ where: { companyId: COMPANY }, select: { id: true, employeeCode: true, status: true, deletedAt: true, managerId: true } });
  const empById = new Map(emps.map((e) => [e.id, e]));
  const working = (id: string) => { const e = empById.get(id); return !!e && !e.deletedAt && e.status === "ACTIVE"; };
  const code = (id: string) => empById.get(id)?.employeeCode ?? "?";

  const rounds = await real.appraisalRound.findMany({
    where: { companyId: COMPANY, deletedAt: null },
    select: {
      id: true, name: true, status: true, isTemplate: true, raterTypes: true, perspectiveWeights: true, raterPairs: true, startDate: true, endDate: true, formSnapshot: true, openedAt: true,
      participants: { select: { id: true, employeeId: true, formId: true, resultStatus: true, scorePercent: true, grade: true, scoreBreakdown: true, adjustedAt: true, originalScorePercent: true,
        assignments: { select: { id: true, raterEmployeeId: true, raterType: true, status: true, answers: true, submittedAt: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  const todayIso = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  for (const r of rounds as any[]) {
    const imported = r.participants.some((p: any) => p.scoreBreakdown?.source === "favpo-import");
    const asg = r.participants.flatMap((p: any) => p.assignments.map((a: any) => ({ ...a, p })));
    const sub = asg.filter((a: any) => a.status === "SUBMITTED").length;
    const st = new Map<string, number>();
    for (const p of r.participants) st.set(p.resultStatus, (st.get(p.resultStatus) ?? 0) + 1);
    add(true, `R "${r.name}" [${r.status}${r.isTemplate ? ", template" : ""}${imported ? ", imported" : ""}]`,
      `people ${r.participants.length}; sheets ${asg.length} (submitted ${sub}); results ${[...st].map(([k, v]) => `${k}:${v}`).join(" ") || "-"}; raterTypes ${r.raterTypes.join("/")}; start ${r.startDate?.toISOString().slice(0, 10) ?? "-"} end ${r.endDate?.toISOString().slice(0, 10) ?? "-"}`);

    // dates and status
    if (r.startDate && r.endDate) add(r.endDate >= r.startDate, `  dates: ${r.name} ends on or after it starts`);
    if (r.status === "OPEN" && r.endDate) add(r.endDate.toISOString().slice(0, 10) >= todayIso, `  open round is not past its end date: ${r.name}`, `end ${r.endDate.toISOString().slice(0, 10)} today ${todayIso}`);
    if (r.status === "SCHEDULED" && r.startDate) add(r.startDate.toISOString().slice(0, 10) > todayIso, `  scheduled round has not passed its start day: ${r.name}`);

    // perspective weights add up
    const types: string[] = r.raterTypes;
    const w = (r.perspectiveWeights ?? {}) as Record<string, number>;
    if (types.length > 1 && !imported) {
      const total = types.reduce((s, t) => s + (w[t] ?? 0), 0);
      add(total === 100, `  perspective weights of the chosen raters add up to 100: ${r.name}`, `total ${total} (${types.map((t) => `${t}:${w[t] ?? 0}`).join(" ")})`);
    }

    if (r.isTemplate || !asg.length) {
      const pairs = readOverrides(r.raterPairs);
      const dead = [...pairs.add, ...pairs.remove].filter((m: any) => !working(m.raterId) || !working(m.participantId));
      if (pairs.add.length || pairs.remove.length) add(dead.length === 0, `  hand-set pairs only name people who still work: ${r.name}`, `${pairs.add.length} added, ${pairs.remove.length} removed; ${dead.length} name someone who left (${list([...new Set(dead.map((m: any) => code(m.raterId)))])})`);
      const noRater = r.participants.length - new Set(pairs.add.map((m: any) => m.participantId)).size;
      if (r.isTemplate) add(true, `  (info) template ${r.name}`, `${r.participants.length} people, ${pairs.add.length} pairs; people with no hand-set rater ${noRater}`);
      continue;
    }

    // who rates whom
    const bad: string[] = [];
    for (const a of asg) {
      if (a.raterType === "SELF" && a.raterEmployeeId !== a.p.employeeId) bad.push(`SELF!=self ${code(a.p.employeeId)}`);
      if (a.raterType !== "SELF" && a.raterEmployeeId === a.p.employeeId) bad.push(`${a.raterType} rates self ${code(a.p.employeeId)}`);
      if (!types.includes(a.raterType)) bad.push(`type ${a.raterType} not in round ${code(a.p.employeeId)}`);
    }
    add(bad.length === 0, `  pairs are coherent (self only by self, types belong to the round): ${r.name}`, list(bad));
    if (!imported) {
      const left = [...new Set(asg.filter((a: any) => !working(a.raterEmployeeId) && a.status !== "SUBMITTED").map((a: any) => code(a.raterEmployeeId)))];
      add(left.length === 0, `  nobody still has to rate who no longer works: ${r.name}`, list(left));
      const mgrMis = asg.filter((a: any) => a.raterType === "MANAGER" && a.raterEmployeeId !== empById.get(a.p.employeeId)?.managerId);
      add(true, `  (info) manager sheets whose rater is not the manager in the org chart today: ${r.name}`, `${mgrMis.length} of ${asg.filter((a: any) => a.raterType === "MANAGER").length}${mgrMis.length ? ": " + list(mgrMis.map((a: any) => `${code(a.p.employeeId)}<-${code(a.raterEmployeeId)}`)) : ""}`);
      const noSheet = r.participants.filter((p: any) => p.assignments.length === 0).map((p: any) => code(p.employeeId));
      add(noSheet.length === 0, `  everyone being rated has at least one rater: ${r.name}`, list(noSheet));
      const load = new Map<string, number>();
      for (const a of asg) if (a.raterEmployeeId !== a.p.employeeId) load.set(a.raterEmployeeId, (load.get(a.raterEmployeeId) ?? 0) + 1);
      const over = [...load].filter(([, n]) => n > MAX_LOAD).map(([id, n]) => `${code(id)}:${n}`);
      add(over.length === 0, `  nobody has more than ${MAX_LOAD} people to rate: ${r.name}`, list(over));
    }

    // sheet states and answers
    const stateBad: string[] = [];
    const rangeBad: string[] = [];
    const qBad: string[] = [];
    for (const a of asg) {
      if (a.status === "SUBMITTED" && (!a.submittedAt || !a.answers)) stateBad.push(`submitted without ${!a.submittedAt ? "date" : "answers"} ${code(a.p.employeeId)}`);
      if (a.status !== "SUBMITTED" && a.submittedAt) stateBad.push(`has submit date but status ${a.status} ${code(a.p.employeeId)}`);
      const snap = r.formSnapshot as any;
      const form = snap?.forms?.[a.p.formId ?? snap?.defaultFormId];
      if (a.status === "SUBMITTED" && Array.isArray(a.answers) && form) {
        const qs = new Map<string, any>(form.questions.map((q: any) => [q.id, q]));
        for (const x of a.answers as any[]) {
          const q = qs.get(x.questionId);
          if (!q) { qBad.push(code(a.p.employeeId)); continue; }
          if (q.answerType === "RATING") { const v = Number(x.value); if (!(v >= 1 && v <= form.ratingMax)) rangeBad.push(`${code(a.p.employeeId)}:${x.value}/${form.ratingMax}`); }
        }
      }
    }
    add(stateBad.length === 0, `  sheet status, date and answers agree: ${r.name}`, list(stateBad));
    add(rangeBad.length === 0, `  every rating is inside the form's scale: ${r.name}`, list(rangeBad));
    add(qBad.length === 0, `  every answer belongs to a question of the frozen form: ${r.name}`, list([...new Set(qBad)]));
  }

  // scores: fresh recalculation against what is stored (rounds with real answer sheets, people not adjusted by hand)
  for (const r of rounds as any[]) {
    const diffs: string[] = [];
    let checked = 0;
    const snap = r.formSnapshot as any;
    for (const p of r.participants as any[]) {
      if (p.scoreBreakdown?.source === "favpo-import" || p.adjustedAt || p.scorePercent === null || !snap) continue;
      const form = snap.forms?.[p.formId ?? snap.defaultFormId];
      if (!form) continue;
      const res = computeResult({
        questions: form.questions, ratingMax: form.ratingMax,
        raters: p.assignments.filter((a: any) => a.status === "SUBMITTED").map((a: any) => ({ raterType: a.raterType, answers: Array.isArray(a.answers) ? a.answers : [] })),
        perspectiveWeights: (r.perspectiveWeights ?? {}) as any, mode: settings.calcMode, bands: settings.bands,
      });
      checked++;
      if (!res || Math.abs(res.scorePercent - p.scorePercent) > 0.05) diffs.push(`${code(p.employeeId)} stored ${p.scorePercent} vs now ${res?.scorePercent ?? "none"}`);
    }
    if (checked) add(diffs.length === 0, `S scores: stored equals a fresh calculation (${checked} people): ${r.name}`, list(diffs));
    // imported rounds: range and grade
    const imp = (r.participants as any[]).filter((p) => p.scoreBreakdown?.source === "favpo-import");
    if (imp.length) {
      const outRange = imp.filter((p) => p.scorePercent !== null && (p.scorePercent < 0 || p.scorePercent > 100)).length;
      const gradeMis = bands ? imp.filter((p) => p.scorePercent !== null && gradeFor(p.scorePercent, bands) !== p.grade).map((p) => code(p.employeeId)) : [];
      add(outRange === 0, `S imported scores sit between 0 and 100: ${r.name}`, `${outRange} outside`);
      add(true, `S (info) imported grade differs from today's bands: ${r.name}`, `${gradeMis.length} of ${imp.length}${gradeMis.length ? " e.g. " + list(gradeMis, 4) : ""}`);
      add(imp.every((p) => p.scorePercent !== null), `S every imported person has a score: ${r.name}`, `${imp.filter((p) => p.scorePercent === null).length} without`);
    }
    // adjustments leave a trail
    const adj = (r.participants as any[]).filter((p) => p.adjustedAt);
    if (adj.length) {
      const ids = adj.map((p) => p.id);
      const rows = await real.appraisalScoreAdjustment.findMany({ where: { participantId: { in: ids } }, select: { participantId: true } });
      const have = new Set(rows.map((x) => x.participantId));
      add(adj.every((p) => have.has(p.id) && p.originalScorePercent !== null), `S hand-adjusted scores each have a logged reason and the original: ${r.name}`, `${adj.filter((p) => !have.has(p.id)).length} without a log`);
    }
  }

  // people who are expected to be rated but have no manager (so 90/180 cannot match)
  const act = emps.filter((e) => !e.deletedAt && e.status === "ACTIVE");
  const noMgr = act.filter((e) => !e.managerId).map((e) => e.employeeCode);
  add(true, "M (info) working people with no manager in the org chart (no MANAGER sheet can be made for them)", `${noMgr.length}: ${list(noMgr)}`);
  const reports = new Map<string, number>();
  for (const e of act) if (e.managerId) reports.set(e.managerId, (reports.get(e.managerId) ?? 0) + 1);
  const bigTeams = [...reports].filter(([, n]) => n > PEER_LIMIT + 1).map(([id, n]) => `${code(id)}:${n}`);
  add(true, `M (info) managers with more than ${PEER_LIMIT + 1} direct reports: a peer round picks only the first ${PEER_LIMIT} of the others`, `${bigTeams.length}: ${list(bigTeams)}`);
  add(true, "M (info) PRESET_WEIGHTS used by the wizard", JSON.stringify(PRESET_WEIGHTS));

  const after = { p: await real.appraisalParticipant.count(), a: await real.appraisalAssignment.count(), r: await real.appraisalRound.count() };
  add(JSON.stringify(before) === JSON.stringify(after), "nothing was written");
  for (const l of out) console.log(`${l.ok ? "OK   " : "CHECK"} ${l.name}${l.detail ? `\n         ${l.detail}` : ""}`);
  await real.$disconnect();
})().catch((e) => { console.error(e); process.exit(2); });
