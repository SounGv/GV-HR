import { displayName } from "@/lib/format";
import { faces } from "@/lib/avatar-server";
import { prisma } from "@/lib/prisma";
import { NotFound } from "@/lib/api/errors";
import { commentsFor, parseImportedComments } from "./imported-comments";
import { pickForm, type RoundSnapshot } from "./form-snapshot";
import { sheetPercent } from "./rater-sheet";
import type { Answer, SnapQuestion } from "./answers";
import { deltaOf, meanOf, monthLabelFromName, previousDepartmentMean, previousScore, ranksFor, sectionPercents, type RoundStamp, type ScoredRow } from "./detail-report-rules";
import { resolveDepartment } from "./exec-summary-rules";
import type { DetailHistory, DetailOverview, DetailPerson, DetailPersonView, DetailRoundOption, DetailRoundPoint, DetailTeam } from "./detail-report-types";
import type { RaterType } from "./types";

/**
 * The detailed evaluation report for HR: every score, who gave it and what they wrote, by person, by team and across rounds.
 * Read only: nothing here writes, and no score is recalculated (the figures are the ones already stored on each participant).
 * The caller must hold `campaign:update` (HR); the route checks it. Queries run one after another because the pool has one slot.
 */

const BINS = [
  { label: "ต่ำกว่า 60", from: 0, to: 59.99 },
  { label: "60-69", from: 60, to: 69.99 },
  { label: "70-79", from: 70, to: 79.99 },
  { label: "80-89", from: 80, to: 89.99 },
  { label: "90-99", from: 90, to: 99.99 },
  { label: "100", from: 100, to: 100 },
];

const monthLabel = (d: Date) => new Intl.DateTimeFormat("th-TH", { month: "short", year: "2-digit", timeZone: "Asia/Bangkok" }).format(d);

interface Scored extends ScoredRow {
  participantId: string;
  grade: string | null;
  types: { raterType: string; percent: number }[];
}

async function loadScored(companyId: string) {
  // Department names a round stored may no longer exist (renamed or split); those show as the person's current department.
  const live = new Set((await prisma.department.findMany({ where: { companyId, deletedAt: null }, select: { name: true } })).map((d) => d.name));
  const rows = await prisma.appraisalParticipant.findMany({
    // People who have since been removed from the system are left out, the same as on the summary report page, so the two pages count the same people (owner's decision, 2026-11-26).
    where: { scorePercent: { not: null }, employee: { deletedAt: null }, round: { companyId, deletedAt: null, isTemplate: false, status: { in: ["OPEN", "CLOSED"] } } },
    select: {
      id: true,
      roundId: true,
      employeeId: true,
      departmentName: true,
      scorePercent: true,
      grade: true,
      scoreBreakdown: true,
      employee: { select: { department: { select: { name: true } } } },
      round: { select: { name: true, status: true, startDate: true, openedAt: true, createdAt: true } },
    },
  });
  const rounds = new Map<string, DetailRoundOption & { at: number; label: string }>();
  const scored: Scored[] = [];
  for (const r of rows) {
    const when = r.round.startDate ?? r.round.openedAt ?? r.round.createdAt;
    const cur = rounds.get(r.roundId);
    if (cur) cur.people += 1;
    else rounds.set(r.roundId, { id: r.roundId, name: r.round.name, status: r.round.status, dateIso: when.toISOString().slice(0, 10), people: 1, at: when.getTime(), label: monthLabelFromName(r.round.name) ?? monthLabel(when) });
    const types = (r.scoreBreakdown as { types?: { raterType: string; percent: number }[] } | null)?.types ?? [];
    scored.push({
      roundId: r.roundId,
      employeeId: r.employeeId,
      department: resolveDepartment(r.departmentName, live, r.employee.department?.name ?? null),
      score: r.scorePercent as number,
      participantId: r.id,
      grade: r.grade,
      types: Array.isArray(types) ? types : [],
    });
  }
  const ordered = [...rounds.values()].sort((a, b) => b.at - a.at);
  return { rounds: ordered, scored, live };
}

const stamps = (rounds: { id: string; at: number }[]): RoundStamp[] => rounds.map((r) => ({ id: r.id, at: r.at }));

function historyUpTo(
  rounds: (DetailRoundOption & { at: number; label: string })[],
  scored: Scored[],
  roundId: string,
  departments: string[],
  employeeIds: string[],
  limit = 6,
): DetailHistory {
  const upTo = rounds
    .filter((r) => r.at <= (rounds.find((x) => x.id === roundId)?.at ?? 0))
    .sort((a, b) => a.at - b.at)
    .slice(-limit);
  const point = (r: DetailRoundPoint & object): DetailRoundPoint => ({ id: r.id, label: r.label, name: r.name });
  return {
    rounds: upTo.map(point),
    company: upTo.map((r) => meanOf(scored.filter((s) => s.roundId === r.id).map((s) => s.score))),
    teams: departments.map((department) => ({
      department,
      values: upTo.map((r) => meanOf(scored.filter((s) => s.roundId === r.id && s.department === department).map((s) => s.score))),
    })),
    people: employeeIds.map((employeeId) => ({
      employeeId,
      values: upTo.map((r) => scored.find((s) => s.roundId === r.id && s.employeeId === employeeId)?.score ?? null),
    })),
  };
}

export async function getDetailOverview(companyId: string, roundId?: string | null): Promise<DetailOverview> {
  const { rounds, scored } = await loadScored(companyId);
  const empty: DetailOverview = {
    rounds: [],
    roundId: null,
    roundName: "",
    status: "",
    ratingMax: 5,
    companyAvg: null,
    bins: BINS,
    people: [],
    teams: [],
    progress: { submitted: 0, total: 0 },
    sectionNames: [],
    history: { rounds: [], company: [], teams: [], people: [] },
  };
  if (rounds.length === 0) return empty;
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0];
  const mine = scored.filter((s) => s.roundId === round.id);
  const detail = await prisma.appraisalParticipant.findMany({
    where: { roundId: round.id, id: { in: mine.map((s) => s.participantId) } },
    select: {
      id: true,
      formId: true,
      positionName: true,
      importedComments: true,
      employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true } },
      assignments: { where: { status: "SUBMITTED" }, select: { answers: true } },
    },
  });
  const byId = new Map(detail.map((d) => [d.id, d]));
  const snap = await prisma.appraisalRound.findUnique({ where: { id: round.id }, select: { formSnapshot: true } });
  const snapshot = snap?.formSnapshot as unknown as RoundSnapshot | null;
  const form = pickForm(snapshot, null);
  // Per person: the mean of each section over their submitted sheets (their own form), and the words the raters wrote.
  const sectionNames: string[] = [];
  const perPerson = new Map<string, { sections: Map<string, number>; comment: string; raters: number }>();
  for (const d of detail) {
    const f = pickForm(snapshot, d.formId);
    const qs = (f?.questions ?? []) as SnapQuestion[];
    const sheets = d.assignments.map((a) => (Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : []));
    const sections = sectionPercents(qs, sheets, f?.ratingMax ?? 5);
    for (const name of sections.keys()) if (!sectionNames.includes(name)) sectionNames.push(name);
    const textIds = new Set(qs.filter((q) => q.answerType === "SHORT_TEXT" || q.answerType === "PARAGRAPH").map((q) => q.id));
    const typed = sheets.flatMap((sheet) => sheet.filter((x) => textIds.has(x.questionId) && typeof x.value === "string" && x.value.trim()).map((x) => (x.value as string).trim()));
    const importedRaw = parseImportedComments(d.importedComments);
    const imported = commentsFor(importedRaw, true)?.texts ?? [];
    // A round copied from Favpo has no sheets of its own; it carries the number of raters Favpo reported.
    perPerson.set(d.id, { sections, comment: [...typed, ...imported].join(" / "), raters: sheets.length || importedRaw?.raters || 0 });
  }
  const photo = await faces(mine.map((s) => s.employeeId));
  const stamp = stamps(rounds);
  const ranks = ranksFor(mine.map((s) => s.score));
  const people: DetailPerson[] = mine
    .map((s, i) => {
      const d = byId.get(s.participantId);
      const prev = previousScore(scored, stamp, round.id, s.employeeId);
      return {
        participantId: s.participantId,
        employeeId: s.employeeId,
        name: d ? displayName(d.employee) : "-",
        code: d?.employee.employeeCode ?? "",
        department: s.department,
        position: d?.positionName ?? "",
        avatarUrl: photo.get(s.employeeId)?.avatarUrl ?? null,
        gender: photo.get(s.employeeId)?.gender ?? null,
        total: s.score,
        grade: s.grade,
        rank: ranks[i],
        prev,
        delta: deltaOf(s.score, prev),
        raters: perPerson.get(s.participantId)?.raters ?? 0,
        sections: sectionNames.map((n) => perPerson.get(s.participantId)?.sections.get(n) ?? null),
        comment: perPerson.get(s.participantId)?.comment ?? "",
      };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "th"));

  // Every rater of everyone in the round, by status (the question "is the picture complete").
  const byStatus = await prisma.appraisalAssignment.groupBy({ by: ["status"], where: { participant: { roundId: round.id, employee: { deletedAt: null } } }, _count: { _all: true } });
  const progress = { submitted: byStatus.find((x) => x.status === "SUBMITTED")?._count._all ?? 0, total: byStatus.reduce((s, x) => s + x._count._all, 0) };

  const departments = [...new Set(mine.map((s) => s.department))];
  const teams: DetailTeam[] = departments
    .map((department) => {
      const scores = mine.filter((s) => s.department === department).map((s) => s.score);
      const avg = meanOf(scores) as number;
      const prevAvg = previousDepartmentMean(scored, stamp, round.id, department);
      return { department, count: scores.length, avg, min: Math.min(...scores), max: Math.max(...scores), prevAvg, delta: deltaOf(avg, prevAvg), scores };
    })
    .sort((a, b) => b.avg - a.avg);

  return {
    rounds: rounds.map((r) => ({ id: r.id, name: r.name, status: r.status, dateIso: r.dateIso, people: r.people })),
    roundId: round.id,
    roundName: round.name,
    status: round.status,
    ratingMax: form?.ratingMax ?? 5,
    companyAvg: meanOf(mine.map((s) => s.score)),
    bins: BINS,
    progress,
    sectionNames,
    people,
    teams,
    history: historyUpTo(rounds, scored, round.id, departments, mine.map((s) => s.employeeId)),
  };
}

export async function getDetailPerson(companyId: string, roundId: string, participantId: string): Promise<DetailPersonView> {
  const p = await prisma.appraisalParticipant.findFirst({
    where: { id: participantId, roundId, round: { companyId, deletedAt: null } },
    select: {
      id: true,
      employeeId: true,
      formId: true,
      departmentName: true,
      positionName: true,
      scorePercent: true,
      grade: true,
      scoreBreakdown: true,
      importedComments: true,
      employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true, department: { select: { name: true } } } },
      round: { select: { name: true, formSnapshot: true } },
      assignments: {
        select: { id: true, raterType: true, status: true, answers: true, submittedAt: true, rater: { select: { firstName: true, lastName: true, nickname: true } } },
        orderBy: [{ raterType: "asc" }, { submittedAt: "asc" }],
      },
    },
  });
  if (!p) throw NotFound("ไม่พบข้อมูล");
  const form = pickForm(p.round.formSnapshot as unknown as RoundSnapshot | null, p.formId);
  const questions = (form?.questions ?? []) as SnapQuestion[];
  const ratingMax = form?.ratingMax ?? 5;
  const answersOf = (a: unknown): Answer[] => (Array.isArray(a) ? (a as unknown as Answer[]) : []);
  const qText = new Map(questions.map((q) => [q.id, q.text]));

  const { rounds, scored, live } = await loadScored(companyId);
  const department = resolveDepartment(p.departmentName, live, p.employee.department?.name ?? null);
  const inRound = scored.filter((s) => s.roundId === roundId);
  const mineRow = inRound.find((s) => s.participantId === p.id);
  const ranks = ranksFor(inRound.map((s) => s.score));
  const rank = mineRow ? ranks[inRound.indexOf(mineRow)] : null;
  const deptAvg = meanOf(inRound.filter((s) => s.department === department).map((s) => s.score));
  const companyAvg = meanOf(inRound.map((s) => s.score));
  const stamp = stamps(rounds);

  // Sections: this person's mean per section against the mean of the same department in this round (everyone's submitted sheets).
  const submitted = p.assignments.filter((a) => a.status === "SUBMITTED");
  const mySections = sectionPercents(questions, submitted.map((a) => answersOf(a.answers)), ratingMax);
  const roundPeople = await prisma.appraisalParticipant.findMany({
    where: { roundId, id: { not: p.id }, employee: { deletedAt: null } },
    select: { departmentName: true, employee: { select: { department: { select: { name: true } } } }, assignments: { where: { status: "SUBMITTED" }, select: { answers: true } } },
  });
  const peers = roundPeople.filter((x) => resolveDepartment(x.departmentName, live, x.employee.department?.name ?? null) === department);
  const deptSections = sectionPercents(questions, peers.flatMap((x) => x.assignments.map((a) => answersOf(a.answers))), ratingMax);
  const sections = [...mySections.entries()].map(([name, me]) => ({ name, me, dept: deptSections.get(name) ?? null }));

  // Company mean by perspective for the bar chart.
  const typeSums = new Map<string, number[]>();
  for (const s of inRound) for (const t of s.types) typeSums.set(t.raterType, [...(typeSums.get(t.raterType) ?? []), t.percent]);
  const companyTypes = [...typeSums.entries()].map(([raterType, v]) => ({ raterType: raterType as RaterType, percent: meanOf(v) as number }));

  const breakdown = (p.scoreBreakdown as { types?: { raterType: string; raters: number; percent: number; weightUsed: number }[] } | null)?.types ?? [];
  const weightOf = new Map(breakdown.map((t) => [t.raterType, t.weightUsed]));

  const raters = p.assignments.map((a) => ({
    assignmentId: a.id,
    name: displayName(a.rater),
    raterType: a.raterType as RaterType,
    weightUsed: weightOf.get(a.raterType) ?? null,
    percent: a.status === "SUBMITTED" ? sheetPercent(a.answers, questions, ratingMax) : null,
    status: a.status,
    submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
  }));

  const sheets = submitted.filter((a) => sheetPercent(a.answers, questions, ratingMax) !== null);
  const ratingQs = questions.filter((q) => q.answerType === "RATING");
  const matrix = {
    columns: sheets.map((a) => ({ assignmentId: a.id, label: displayName(a.rater), raterType: a.raterType as RaterType })),
    rows: ratingQs.map((q) => {
      const scores = sheets.map((a) => {
        const hit = answersOf(a.answers).find((x) => x.questionId === q.id);
        return hit && typeof hit.value === "number" ? hit.value : null;
      });
      const got = scores.filter((v): v is number => v !== null);
      return { questionId: q.id, text: q.text, section: q.section?.trim() || "ทั่วไป", scores, avg: got.length ? Math.round((got.reduce((s, v) => s + v, 0) / got.length) * 10) / 10 : null };
    }),
  };

  const textIds = new Set(questions.filter((q) => q.answerType === "SHORT_TEXT" || q.answerType === "PARAGRAPH").map((q) => q.id));
  const comments = submitted.flatMap((a) => {
    const ans = answersOf(a.answers);
    const texts = ans
      .filter((x) => textIds.has(x.questionId) && typeof x.value === "string" && x.value.trim())
      .map((x) => ({ question: qText.get(x.questionId) ?? "", text: (x.value as string).trim() }));
    const notes = ans
      .filter((x) => typeof x.note === "string" && x.note.trim() && typeof x.value === "number")
      .map((x) => ({ question: qText.get(x.questionId) ?? "", score: x.value as number, text: (x.note as string).trim() }));
    if (texts.length === 0 && notes.length === 0) return [];
    return [{ assignmentId: a.id, raterName: displayName(a.rater), raterType: a.raterType as RaterType, percent: sheetPercent(a.answers, questions, ratingMax), submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null, texts, notes }];
  });

  // This person's own scores over the rounds up to this one, with the department and company mean of each round.
  const here = rounds.find((r) => r.id === roundId);
  const upTo = rounds.filter((r) => r.at <= (here?.at ?? 0)).sort((a, b) => a.at - b.at).slice(-6);
  const photo = await faces([p.employeeId]);
  const history = {
    rounds: upTo.map((r) => ({ id: r.id, label: r.label, name: r.name })),
    me: upTo.map((r) => scored.find((s) => s.roundId === r.id && s.employeeId === p.employeeId)?.score ?? null),
    dept: upTo.map((r) => {
      const mineThen = scored.find((s) => s.roundId === r.id && s.employeeId === p.employeeId);
      return mineThen ? meanOf(scored.filter((s) => s.roundId === r.id && s.department === mineThen.department).map((s) => s.score)) : null;
    }),
    company: upTo.map((r) => meanOf(scored.filter((s) => s.roundId === r.id).map((s) => s.score))),
  };

  return {
    participantId: p.id,
    employeeId: p.employeeId,
    name: displayName(p.employee),
    code: p.employee.employeeCode,
    department,
    position: p.positionName ?? "",
    avatarUrl: photo.get(p.employeeId)?.avatarUrl ?? null,
    gender: photo.get(p.employeeId)?.gender ?? null,
    roundName: p.round.name,
    ratingMax,
    total: p.scorePercent,
    grade: p.grade,
    rank,
    rankOf: inRound.length,
    deptAvg,
    companyAvg,
    prev: previousScore(scored, stamp, roundId, p.employeeId),
    types: breakdown.map((t) => ({ raterType: t.raterType as RaterType, raters: t.raters, percent: t.percent, weightUsed: t.weightUsed })),
    companyTypes,
    sections,
    raters,
    matrix,
    comments,
    imported: commentsFor(parseImportedComments(p.importedComments), true),
    history,
  };
}
