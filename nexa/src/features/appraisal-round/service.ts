import { displayName } from "@/lib/format";
import { avatarPaths } from "@/lib/avatar-server";
import { requireEmployeeId } from "@/lib/auth/employee";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { BadRequest, NotFound } from "@/lib/api/errors";
import type { AccessClaims } from "@/lib/auth/jwt";
import { bangkokParts } from "@/lib/datetime";
import { can } from "@/lib/auth/rbac";
import { isLineConfigured } from "@/lib/integrations/line";
import { createNotification } from "@/features/notification/service";
import { loadProbationDue } from "@/features/dashboard-people/service";
import { formsInUse, pickForm, type RoundSnapshot } from "./form-snapshot";
import { cleanAnswers, summarizeAnswers, unansweredRequired, visibleQuestions, type Answer, type QuestionSummary, type SnapQuestion } from "./answers";
import {
  applyRaterOverrides,
  autoRaterTypes,
  matchRaters,
  planInvitations,
  readOverrides,
  roundChecks,
  sendMode,
  shouldRemind,
  type Match,
  type RaterPairOverrides,
  type RaterType,
  type RosterPerson,
  PRESETS,
} from "./rules";
import type { RoundUpdateInput } from "./schema";
import { makeDueRecurringRounds } from "./recurrence-service";
import { participantScope, viewableEmployeeIds } from "./viewer-scope";
import { commentsFor, holdsBackTexts, parseImportedComments, type CommentsView } from "./imported-comments";
import { sheetPercent } from "./rater-sheet";

type Meta = { ip?: string; userAgent?: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fullName = (e: { firstName: string; lastName: string; nickname: string | null }) => displayName(e);
const fmtDay = (isoDay: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDay}T00:00:00Z`),
  );
const asWeights = (v: Prisma.JsonValue | null): Partial<Record<RaterType, number>> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<Record<RaterType, number>>) : {};

/** "90°" … "360°" or "ประเมินขึ้น" when the round asks exactly the people of one preset, else "กำหนดเอง". */
function presetNameOf(types: RaterType[] | null): string {
  const set = new Set(types ?? []);
  for (const k of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    const want = PRESETS[k];
    if (want.length === set.size && want.every((x) => set.has(x))) return k === "UP" ? "ประเมินขึ้น" : `${k}°`;
  }
  return "กำหนดเอง";
}

/* ───────────────────────────── HR side ───────────────────────────── */

export async function listRounds(companyId: string) {
  const rounds = await prisma.appraisalRound.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      startDate: true,
      endDate: true,
      isTemplate: true,
      raterTypes: true,
      form: { select: { name: true, version: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const out = [];
  // Sequential, not Promise.all — connection_limit=1.
  for (const r of rounds) {
    let submitted = 0;
    let total = 0;
    if (r.status === "OPEN" || r.status === "CLOSED") {
      const groups = await prisma.appraisalAssignment.groupBy({
        by: ["status"],
        where: { participant: { roundId: r.id } },
        _count: { _all: true },
      });
      for (const g of groups) {
        total += g._count._all;
        if (g.status === "SUBMITTED") submitted += g._count._all;
      }
    }
    out.push({
      id: r.id,
      name: r.name,
      status: r.status,
      isTemplate: r.isTemplate,
      ratingType: presetNameOf(r.raterTypes as RaterType[]),
      formName: `${r.form.name} เวอร์ชัน ${r.form.version}`,
      startIso: r.startDate ? iso(r.startDate) : null,
      endIso: r.endDate ? iso(r.endDate) : null,
      participantCount: r._count.participants,
      submitted,
      total,
    });
  }
  return out;
}

/** Active employees HR can pick as people to evaluate. */
export async function listCandidates(companyId: string) {
  const rows = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      nickname: true,
      managerId: true,
      gender: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { employeeCode: "asc" }],
  });
  const photos = await avatarPaths(rows.map((e) => e.id));
  return rows.map((e) => ({
    id: e.id,
    code: e.employeeCode,
    name: fullName(e),
    departmentId: e.department?.id ?? null,
    department: e.department?.name ?? "ไม่ระบุแผนก",
    hasManager: !!e.managerId,
    gender: e.gender ?? null,
    avatarUrl: photos.get(e.id) ?? null,
  }));
}

export async function createRound(companyId: string, session: AccessClaims, name: string, meta?: Meta) {
  const published = await prisma.appraisalForm.findFirst({
    where: { companyId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true },
    orderBy: { publishedAt: "desc" },
  });
  if (!published) throw BadRequest("ยังไม่มีแบบประเมินที่ใช้งานแล้ว กรุณาสร้างและยืนยันใช้แบบประเมินก่อน");
  const round = await prisma.appraisalRound.create({
    data: { companyId, name, formId: published.id, createdById: session.sub, updatedById: session.sub },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.create",
    entity: "AppraisalRound",
    entityId: round.id,
    after: { name },
    ...meta,
  });
  return round;
}

async function loadDraft(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  return round;
}

/** Keeps only pairs between real people of this company, once each; nothing left means "nothing set by hand" (null). */
async function cleanPairs(companyId: string, raw: unknown): Promise<RaterPairOverrides | null> {
  const ov = readOverrides(raw);
  const manual = ov.manualPeers === true;
  const ids = [...new Set([...ov.add, ...ov.remove].flatMap((m) => [m.participantId, m.raterId]))];
  if (ids.length === 0) return manual ? { add: [], remove: [], manualPeers: true } : null;
  const found = new Set(
    (await prisma.employee.findMany({ where: { id: { in: ids }, companyId, deletedAt: null }, select: { id: true } })).map((e) => e.id),
  );
  const tidy = (list: Match[]) => [
    ...new Map(list.filter((m) => found.has(m.participantId) && found.has(m.raterId)).map((m) => [`${m.participantId}|${m.raterId}|${m.raterType}`, m])).values(),
  ];
  const out: RaterPairOverrides = { add: tidy(ov.add), remove: tidy(ov.remove), ...(manual ? { manualPeers: true } : {}) };
  return out.add.length || out.remove.length || manual ? out : null;
}

export async function updateRound(companyId: string, session: AccessClaims, id: string, input: RoundUpdateInput, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "DRAFT") throw BadRequest("รอบนี้เปิดแล้ว แก้ไขไม่ได้");

  if (input.formId) {
    const form = await prisma.appraisalForm.findFirst({
      where: { id: input.formId, companyId, deletedAt: null, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!form) throw BadRequest("เลือกได้เฉพาะแบบประเมินที่ใช้งานแล้ว");
  }

  await prisma.appraisalRound.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.formId !== undefined ? { formId: input.formId } : {}),
      ...(input.raterTypes !== undefined ? { raterTypes: input.raterTypes } : {}),
      ...(input.perspectiveWeights !== undefined ? { perspectiveWeights: input.perspectiveWeights } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null } : {}),
      ...(input.remind !== undefined ? { remind: input.remind } : {}),
      ...(input.notifyLine !== undefined ? { notifyLine: input.notifyLine } : {}),
      updatedById: session.sub,
    },
  });

  if (input.participantIds) {
    const people = await prisma.employee.findMany({
      where: { id: { in: input.participantIds }, companyId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, department: { select: { name: true } }, position: { select: { title: true } } },
    });
    const keep = new Set(people.map((p) => p.id));
    await prisma.appraisalParticipant.deleteMany({ where: { roundId: id, employeeId: { notIn: [...keep] } } });
    const existing = new Set(
      (await prisma.appraisalParticipant.findMany({ where: { roundId: id }, select: { employeeId: true } })).map((p) => p.employeeId),
    );
    await prisma.appraisalParticipant.createMany({
      data: people
        .filter((p) => !existing.has(p.id))
        .map((p) => ({
          roundId: id,
          employeeId: p.id,
          departmentName: p.department?.name ?? null,
          positionName: p.position?.title ?? null,
        })),
      skipDuplicates: true,
    });
  }

  if (input.participantForms) {
    const entries = Object.entries(input.participantForms);
    const wanted = [...new Set(entries.map(([, f]) => f).filter((f): f is string => !!f))];
    if (wanted.length) {
      const ok = await prisma.appraisalForm.findMany({
        where: { id: { in: wanted }, companyId, deletedAt: null, status: "PUBLISHED" },
        select: { id: true },
      });
      if (ok.length !== wanted.length) throw BadRequest("เลือกได้เฉพาะแบบประเมินที่ใช้งานแล้ว");
    }
    // One update per form (sequential: connection_limit=1); null puts people back on the round's own form.
    for (const formId of [...wanted, null]) {
      const employeeIds = entries.filter(([, f]) => f === formId).map(([e]) => e);
      if (employeeIds.length === 0) continue;
      await prisma.appraisalParticipant.updateMany({ where: { roundId: id, employeeId: { in: employeeIds } }, data: { formId } });
    }
  }

  let pairsAfter: { add: number; remove: number } | undefined;
  if (input.raterPairs !== undefined) {
    const clean = await cleanPairs(companyId, input.raterPairs);
    await prisma.appraisalRound.update({ where: { id }, data: { raterPairs: clean ? (clean as unknown as Prisma.InputJsonValue) : Prisma.DbNull } });
    pairsAfter = { add: clean?.add.length ?? 0, remove: clean?.remove.length ?? 0 };
  } else if (input.participantIds) {
    // People taken out of the round take their hand-set pairs with them, so nothing invisible is left behind.
    const row = await prisma.appraisalRound.findUnique({ where: { id }, select: { raterPairs: true } });
    const cur = readOverrides(row?.raterPairs);
    if (cur.add.length || cur.remove.length) {
      const stay = new Set((await prisma.appraisalParticipant.findMany({ where: { roundId: id }, select: { employeeId: true } })).map((p) => p.employeeId));
      const next = { ...cur, add: cur.add.filter((m) => stay.has(m.participantId)), remove: cur.remove.filter((m) => stay.has(m.participantId)) };
      if (next.add.length !== cur.add.length || next.remove.length !== cur.remove.length) {
        await prisma.appraisalRound.update({
          where: { id },
          data: { raterPairs: next.add.length || next.remove.length || next.manualPeers ? (next as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
        });
        pairsAfter = { add: next.add.length, remove: next.remove.length };
      }
    }
  }

  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.update",
    entity: "AppraisalRound",
    entityId: id,
    ...(pairsAfter ? { after: { raterPairs: pairsAfter } } : {}),
    ...meta,
  });
  return { id };
}

async function loadRoster(companyId: string) {
  return prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      managerId: true,
      status: true,
      firstName: true,
      lastName: true,
      nickname: true,
      userId: true,
      lineUserId: true,
      gender: true,
      department: { select: { name: true } },
    },
  });
}

/**
 * Everything the wizard shows for one round: the saved choices, the matching result and the readiness list.
 *
 * Pass `viewer` when the answer goes to a person. Anyone without `campaign:update` (a manager, who holds only
 * `campaign:manage`) gets the round's summary with every name and rater list left out: who rates whom is
 * limited to the people they may see on the tracking and results screens, which are scoped separately.
 */
export async function getRound(companyId: string, id: string, viewer?: AccessClaims) {
  const detail = await loadRoundDetail(companyId, id);
  if (!viewer || can(viewer.perms, "campaign:update")) return detail;
  return {
    ...detail,
    participantCount: detail.participantIds.length,
    participantIds: [],
    participantForms: {},
    overrides: { add: [], remove: [] },
    matching: { ...detail.matching, exceptions: [], rows: [] },
    invitations: { ...detail.invitations, unreachableNames: [], example: null },
  };
}

async function loadRoundDetail(companyId: string, id: string) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      formId: true,
      form: { select: { name: true, version: true, status: true } },
      raterTypes: true,
      perspectiveWeights: true,
      raterPairs: true,
      startDate: true,
      endDate: true,
      remind: true,
      notifyLine: true,
      openedAt: true,
      notifiedAt: true,
      participants: { select: { employeeId: true, formId: true } },
    },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");

  const usedIds = formsInUse(round.formId, round.participants.map((p) => p.formId));
  const usedForms = await prisma.appraisalForm.findMany({
    where: { id: { in: usedIds }, companyId },
    select: { id: true, name: true, version: true, status: true },
  });
  const allPublished = usedForms.length === usedIds.length && usedForms.every((f) => f.status === "PUBLISHED");

  const roster = await loadRoster(companyId);
  const nameOf = new Map(roster.map((e) => [e.id, fullName(e)]));
  const participantIds = round.participants.map((p) => p.employeeId);
  const types = round.raterTypes as RaterType[];
  const weights = asWeights(round.perspectiveWeights);

  const people: RosterPerson[] = roster.map((e) => ({ id: e.id, managerId: e.managerId, active: e.status === "ACTIVE" }));
  // The org chart decides first; what HR set by hand is put on top (see applyRaterOverrides).
  const overrides = readOverrides(round.raterPairs);
  const match = applyRaterOverrides(matchRaters(participantIds, people, autoRaterTypes(types, overrides)), overrides, { participantIds, roster: people, types });
  const manualKeys = new Set(overrides.add.map((m) => `${m.participantId}|${m.raterId}|${m.raterType}`));
  const withoutRater = match.exceptions.filter((e) => e.kind === "NO_RATER").length;

  const reachable = new Set(roster.filter((e) => e.userId).map((e) => e.id));
  const lineLinked = isLineConfigured() ? new Set(roster.filter((e) => e.lineUserId).map((e) => e.id)) : new Set<string>();
  const plan = planInvitations(match.matches, lineLinked, reachable);
  const unreachableNames = plan.lines.filter((l) => !reachable.has(l.raterId)).map((l) => nameOf.get(l.raterId) ?? "-");

  const startIso = round.startDate ? iso(round.startDate) : null;
  const endIso = round.endDate ? iso(round.endDate) : null;
  const checks = roundChecks({
    formPublished: round.form.status === "PUBLISHED" && allPublished,
    participantCount: participantIds.length,
    raterTypes: types,
    weights,
    withoutRater,
    startIso,
    endIso,
  });

  const byType = new Map<string, number>();
  for (const m of match.matches) byType.set(m.raterType, (byType.get(m.raterType) ?? 0) + 1);

  // One row per person for the wizard's "who rates whom" table.
  const rosterById = new Map(roster.map((e) => [e.id, e]));
  const perPerson = new Map<
    string,
    { managerId: string | null; managers: number; self: boolean; peers: number; subs: number; raters: { id: string; name: string; type: RaterType; manual: boolean }[] }
  >();
  for (const pid of participantIds) perPerson.set(pid, { managerId: null, managers: 0, self: false, peers: 0, subs: 0, raters: [] });
  for (const m of match.matches) {
    const row = perPerson.get(m.participantId);
    if (!row) continue;
    row.raters.push({ id: m.raterId, name: nameOf.get(m.raterId) ?? "-", type: m.raterType, manual: manualKeys.has(`${m.participantId}|${m.raterId}|${m.raterType}`) });
    if (m.raterType === "MANAGER") {
      row.managerId ??= m.raterId;
      row.managers++;
    } else if (m.raterType === "SELF") row.self = true;
    else if (m.raterType === "PEER") row.peers++;
    else row.subs++;
  }
  const photos = await avatarPaths([...participantIds, ...[...perPerson.values()].map((r) => r.managerId)]);
  const rows = participantIds.map((pid) => {
    const r = perPerson.get(pid)!;
    const e = rosterById.get(pid);
    return {
      employeeId: pid,
      name: nameOf.get(pid) ?? "-",
      gender: e?.gender ?? null,
      avatarUrl: photos.get(pid) ?? null,
      department: e?.department?.name ?? "ไม่ระบุแผนก",
      managerId: r.managerId,
      managerName: r.managerId ? (nameOf.get(r.managerId) ?? "-") : null,
      managerGender: r.managerId ? (rosterById.get(r.managerId)?.gender ?? null) : null,
      managerAvatarUrl: r.managerId ? (photos.get(r.managerId) ?? null) : null,
      managers: r.managers,
      raters: r.raters,
      self: r.self,
      peers: r.peers,
      subs: r.subs,
    };
  });
  // The rater with the most people: the example message the review step previews.
  const busiest = plan.lines.filter((l) => reachable.has(l.raterId)).sort((a, b) => b.count - a.count)[0];

  return {
    id: round.id,
    name: round.name,
    status: round.status,
    formId: round.formId,
    formName: `${round.form.name} เวอร์ชัน ${round.form.version}`,
    participantForms: Object.fromEntries(round.participants.filter((p) => p.formId).map((p) => [p.employeeId, p.formId])),
    formsUsed: usedForms.map((f) => ({ id: f.id, name: `${f.name} เวอร์ชัน ${f.version}` })),
    raterTypes: types,
    perspectiveWeights: weights,
    overrides,
    startIso,
    endIso,
    remind: round.remind,
    notifyLine: round.notifyLine,
    openedAt: round.openedAt?.toISOString() ?? null,
    notifiedAt: round.notifiedAt?.toISOString() ?? null,
    participantIds,
    matching: {
      assignmentCount: match.matches.length,
      byType: Object.fromEntries(byType),
      exceptions: match.exceptions.map((e) => ({ kind: e.kind, employeeId: e.employeeId, name: nameOf.get(e.employeeId) ?? "-", detail: e.detail ?? null })),
      raterCount: plan.lines.length,
      /** Pairs HR set by hand: how many were added, taken out, and how many could not apply (left the company, type no longer used). */
      manual: { added: overrides.add.length, removed: overrides.remove.length, ignored: match.ignored },
      rows,
    },
    invitations: {
      total: plan.total,
      withLine: plan.withLine,
      appOnly: plan.appOnly,
      unreachable: plan.unreachable,
      unreachableNames,
      lineConfigured: isLineConfigured(),
      example: busiest ? { name: nameOf.get(busiest.raterId) ?? "-", count: busiest.count } : null,
    },
    checks,
    ready: checks.every((c) => c.ok),
  };
}

export async function listPublishedForms(companyId: string) {
  const forms = await prisma.appraisalForm.findMany({
    where: { companyId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true, name: true, version: true, _count: { select: { questions: true } } },
    orderBy: { publishedAt: "desc" },
  });
  return forms.map((f) => ({ id: f.id, name: `${f.name} เวอร์ชัน ${f.version}`, questionCount: f._count.questions }));
}

/** Progress of a round that is open or closed: submitted / in progress / not started, overall and per rater type. */
export async function getRoundProgress(companyId: string, id: string, session: AccessClaims) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const scope = participantScope(await viewableEmployeeIds(companyId, session), session.employeeId);
  const groups = await prisma.appraisalAssignment.groupBy({
    by: ["raterType", "status"],
    where: { participant: { roundId: id, ...scope } },
    _count: { _all: true },
  });
  const sum = (pred: (g: (typeof groups)[number]) => boolean) =>
    groups.filter(pred).reduce((n, g) => n + g._count._all, 0);
  return {
    total: sum(() => true),
    submitted: sum((g) => g.status === "SUBMITTED"),
    inProgress: sum((g) => g.status === "IN_PROGRESS"),
    pending: sum((g) => g.status === "PENDING"),
  };
}

/** Opens the round: refuses when anything is missing, freezes the form, creates the assignments and (if the start day has come) sends the invitations. */
export async function openRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const detail = await getRound(companyId, id);
  if (detail.status !== "DRAFT") throw BadRequest("รอบนี้เปิดแล้ว");
  const flag = await prisma.appraisalRound.findFirst({ where: { id, companyId }, select: { isTemplate: true } });
  if (flag?.isTemplate) throw BadRequest("แม่แบบเปิดรอบโดยตรงไม่ได้ กดคัดลอกเป็นรอบใหม่ก่อน แล้วตั้งวันที่และเปิดรอบที่คัดลอก");
  const failed = detail.checks.filter((c) => !c.ok);
  if (failed.length) throw BadRequest(`ยังเปิดรอบไม่ได้: ${failed.map((c) => c.why).join(" · ")}`);

  const usedIds = formsInUse(detail.formId, Object.values(detail.participantForms));
  const forms = await prisma.appraisalForm.findMany({
    where: { id: { in: usedIds }, companyId, status: "PUBLISHED", deletedAt: null },
    select: {
      id: true,
      name: true,
      version: true,
      ratingMax: true,
      ratingLabels: true,
      noteAtLowest: true,
      questions: {
        select: {
          id: true,
          order: true,
          text: true,
          helpText: true,
          answerType: true,
          options: true,
          weight: true,
          required: true,
          visibleTo: true,
          levelDescriptions: true,
          section: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (forms.length !== usedIds.length) throw BadRequest("แบบประเมินบางชุดไม่พร้อมใช้งาน");
  // Frozen copy of every form this round uses, keyed by form id.
  const snapshot: RoundSnapshot = {
    defaultFormId: detail.formId,
    forms: Object.fromEntries(forms.map((f) => [f.id, f as unknown as RoundSnapshot["forms"][string]])),
  };

  const roster = await loadRoster(companyId);
  const people: RosterPerson[] = roster.map((e) => ({ id: e.id, managerId: e.managerId, active: e.status === "ACTIVE" }));
  const { matches } = applyRaterOverrides(matchRaters(detail.participantIds, people, autoRaterTypes(detail.raterTypes, detail.overrides)), detail.overrides, {
    participantIds: detail.participantIds,
    roster: people,
    types: detail.raterTypes,
  });

  const participants = await prisma.appraisalParticipant.findMany({ where: { roundId: id }, select: { id: true, employeeId: true } });
  const pidByEmployee = new Map(participants.map((p) => [p.employeeId, p.id]));
  const mode = sendMode(detail.startIso as string, iso(bangkokParts().dateUTC));

  // The round is claimed first, only while it is still a draft: a second open (double click, two tabs) finds it taken
  // and stops here, so it can never delete assignments that raters have already started on.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.appraisalRound.updateMany({
      where: { id, companyId, status: "DRAFT", deletedAt: null },
      data: {
        status: mode === "NOW" ? "OPEN" : "SCHEDULED",
        openedAt: new Date(),
        formSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        updatedById: session.sub,
      },
    });
    if (claimed.count !== 1) throw BadRequest("รอบนี้เปิดแล้ว");
    await tx.appraisalAssignment.deleteMany({ where: { participant: { roundId: id } } });
    await tx.appraisalAssignment.createMany({
      data: matches.map((m) => ({
        participantId: pidByEmployee.get(m.participantId) as string,
        raterEmployeeId: m.raterId,
        raterType: m.raterType,
      })),
      skipDuplicates: true,
    });
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.open",
    entity: "AppraisalRound",
    entityId: id,
    after: { assignments: matches.length, mode },
    ...meta,
  });

  const sent = mode === "NOW" ? await sendInvitations(companyId, id, session.sub) : null;
  return { id, mode, assignments: matches.length, sent };
}

/**
 * One message per rater (in-app inbox, plus LINE when the round has it on and the rater linked it).
 * Only assignments not yet notified are included, so running it twice never messages anyone twice.
 */
export async function sendInvitations(companyId: string, roundId: string, actorUserId?: string | null) {
  const round = await prisma.appraisalRound.findFirst({
    where: { id: roundId, companyId, deletedAt: null },
    select: { id: true, name: true, endDate: true, notifyLine: true, status: true },
  });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");

  const pending = await prisma.appraisalAssignment.findMany({
    where: { participant: { roundId }, notifiedAt: null },
    select: { id: true, raterEmployeeId: true, participantId: true },
  });
  const byRater = new Map<string, { ids: string[]; people: Set<string> }>();
  for (const a of pending) {
    const cur = byRater.get(a.raterEmployeeId) ?? { ids: [], people: new Set<string>() };
    cur.ids.push(a.id);
    cur.people.add(a.participantId);
    byRater.set(a.raterEmployeeId, cur);
  }

  const endText = round.endDate ? ` ปิดรอบวันที่ ${fmtDay(iso(round.endDate))}` : "";
  let sent = 0;
  let failed = 0;
  for (const [raterId, v] of byRater) {
    try {
      await createNotification(
        companyId,
        raterId,
        {
          title: `ถึงรอบประเมิน: ${round.name}`,
          body: `คุณมี ${v.people.size} คนที่ต้องประเมิน${endText}`,
          category: "evaluation",
          link: "/appraisal/tasks",
          line: round.notifyLine,
        },
        actorUserId,
      );
      await prisma.appraisalAssignment.updateMany({ where: { id: { in: v.ids } }, data: { notifiedAt: new Date() } });
      sent++;
    } catch {
      failed++;
    }
  }
  await prisma.appraisalRound.update({
    where: { id: roundId },
    data: { notifiedAt: new Date(), ...(round.status === "SCHEDULED" ? { status: "OPEN" } : {}) },
  });
  return { sent, failed };
}

export async function closeRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "OPEN" && round.status !== "SCHEDULED") throw BadRequest("ปิดได้เฉพาะรอบที่เปิดอยู่");
  await prisma.appraisalRound.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.close", entity: "AppraisalRound", entityId: id, ...meta });
  return { id };
}

/**
 * "สร้างรอบจากรอบเดิม": a new DRAFT with the same form, people, rater types, weights and options.
 * Dates are left empty (a new period) and nothing is sent. People who have left since are not copied.
 * A form that is no longer published is replaced by the newest published version of the same form.
 */
export async function cloneRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const src = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      name: true,
      isTemplate: true,
      raterTypes: true,
      perspectiveWeights: true,
      raterPairs: true,
      remind: true,
      notifyLine: true,
      form: { select: { id: true, lineageId: true, status: true } },
      participants: { select: { employeeId: true, formId: true } },
    },
  });
  if (!src) throw NotFound("ไม่พบรอบประเมิน");

  const published = src.form.status === "PUBLISHED"
    ? src.form
    : await prisma.appraisalForm.findFirst({
        where: { companyId, lineageId: src.form.lineageId, status: "PUBLISHED", deletedAt: null },
        select: { id: true, lineageId: true, status: true },
        orderBy: { version: "desc" },
      });
  if (!published) throw BadRequest("แบบประเมินของรอบนี้ไม่ได้ใช้งานแล้ว และยังไม่มีเวอร์ชันใหม่ที่ยืนยันใช้ กรุณาสร้างรอบใหม่แทน");

  const people = await prisma.employee.findMany({
    where: { id: { in: src.participants.map((p) => p.employeeId) }, companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, department: { select: { name: true } }, position: { select: { title: true } } },
  });
  // A person's own form carries over; if it was replaced by a newer published version, use that one.
  const ownIds = [...new Set(src.participants.map((p) => p.formId).filter((f): f is string => !!f))];
  const ownForms = ownIds.length
    ? await prisma.appraisalForm.findMany({ where: { id: { in: ownIds }, companyId }, select: { id: true, lineageId: true, status: true } })
    : [];
  const latestByLineage = new Map(
    (
      await prisma.appraisalForm.findMany({
        where: { companyId, lineageId: { in: ownForms.map((f) => f.lineageId) }, status: "PUBLISHED", deletedAt: null },
        select: { id: true, lineageId: true, version: true },
        orderBy: { version: "asc" },
      })
    ).map((f) => [f.lineageId, f.id] as const),
  );
  const carry = new Map(ownForms.map((f) => [f.id, latestByLineage.get(f.lineageId) ?? null]));
  const formOf = new Map(src.participants.map((p) => [p.employeeId, p.formId ? (carry.get(p.formId) ?? null) : null]));

  const created = await prisma.appraisalRound.create({
    data: {
      companyId,
      // A copy of a template is an ordinary draft, named without the word "แม่แบบ" so it reads as a round.
      name: src.isTemplate ? src.name.replace(/^แม่แบบ\s*/, "") : `${src.name} (สำเนา)`,
      formId: published.id,
      raterTypes: src.raterTypes,
      perspectiveWeights: (src.perspectiveWeights ?? undefined) as Prisma.InputJsonValue | undefined,
      raterPairs: (src.raterPairs ?? undefined) as Prisma.InputJsonValue | undefined,
      remind: src.remind,
      notifyLine: src.notifyLine,
      createdById: session.sub,
      updatedById: session.sub,
      participants: {
        create: people.map((p) => ({
          employeeId: p.id,
          formId: formOf.get(p.id) ?? null,
          departmentName: p.department?.name ?? null,
          positionName: p.position?.title ?? null,
        })),
      },
    },
    select: { id: true },
  });
  await writeAudit({
    companyId,
    actorUserId: session.sub,
    action: "appraisal_round.clone",
    entity: "AppraisalRound",
    entityId: created.id,
    before: { fromId: id },
    after: { participants: people.length },
    ...meta,
  });
  return created;
}

/**
 * Starts a draft round for the people whose probation ends within the next 30 days (the same list as the dashboard card,
 * limited to the caller's own team). HR then picks the form, raters and dates in the normal steps.
 */
export async function createProbationRound(companyId: string, session: AccessClaims, meta?: Meta) {
  const due = await loadProbationDue(companyId, session);
  if (due.people.length === 0) throw BadRequest("ไม่มีพนักงานที่ครบทดลองงานภายใน 30 วัน");
  const todayText = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
  const round = await createRound(companyId, session, `ประเมินทดลองงาน ${todayText}`, meta);
  await updateRound(companyId, session, round.id, { participantIds: due.people.map((p) => p.employeeId) }, meta);
  return { id: round.id, participants: due.people.length };
}

/** Takes a SCHEDULED round back to a draft (nothing has been sent yet), so it can be edited again. */
export async function unscheduleRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "SCHEDULED") throw BadRequest("ยกเลิกการตั้งเวลาได้เฉพาะรอบที่ตั้งเวลาไว้และยังไม่ได้ส่งข้อความ");
  await prisma.$transaction([
    prisma.appraisalAssignment.deleteMany({ where: { participant: { roundId: id } } }),
    prisma.appraisalRound.update({
      where: { id },
      data: { status: "DRAFT", openedAt: null, formSnapshot: undefined, updatedById: session.sub },
    }),
  ]);
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.unschedule", entity: "AppraisalRound", entityId: id, ...meta });
  return { id };
}

export async function deleteRound(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const round = await loadDraft(companyId, id);
  if (round.status !== "DRAFT") throw BadRequest("ลบได้เฉพาะรอบที่ยังเป็นฉบับร่าง");
  await prisma.appraisalRound.update({ where: { id }, data: { deletedAt: new Date(), updatedById: session.sub } });
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.delete", entity: "AppraisalRound", entityId: id, ...meta });
}

/* ───────────────────────────── Tracking and results ───────────────────────────── */

/** "ตรวจเช็คการประเมิน": every person in the round with the status of each of their raters. */
export async function getRoundMatrix(companyId: string, id: string, session: AccessClaims) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true, formSnapshot: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const scope = participantScope(await viewableEmployeeIds(companyId, session), session.employeeId);
  // The date and the score of each rater's sheet are for HR only: a manager sees who has finished, not what each person gave.
  const isHr = can(session.perms, "campaign:update");
  const rows = await prisma.appraisalParticipant.findMany({
    where: { roundId: id, ...scope },
    select: {
      id: true,
      formId: true,
      departmentName: true,
      employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true } },
      assignments: {
        select: { id: true, raterType: true, status: true, submittedAt: true, ...(isHr ? { answers: true } : {}), rater: { select: { firstName: true, lastName: true, nickname: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { employee: { employeeCode: "asc" } },
    take: 2000,
  });
  return rows.map((p) => ({
    participantId: p.id,
    name: fullName(p.employee),
    code: p.employee.employeeCode,
    department: p.departmentName ?? "ไม่ระบุแผนก",
    assignments: p.assignments.map((a) => {
      const form = isHr ? pickForm(round.formSnapshot as unknown as RoundSnapshot | null, p.formId) : null;
      return {
        id: a.id,
        raterType: a.raterType,
        status: a.status,
        raterName: fullName(a.rater),
        submittedAt: isHr && a.status === "SUBMITTED" && a.submittedAt ? iso(a.submittedAt) : null,
        percent: form && a.status === "SUBMITTED" ? sheetPercent((a as { answers?: unknown }).answers, form.questions ?? [], form.ratingMax ?? 5) : null,
      };
    }),
  }));
}

export interface ParticipantResult {
  participantId: string;
  name: string;
  code: string;
  department: string;
  roundName: string;
  roundStatus: string;
  ratingMax: number;
  ratingLabels: unknown;
  groups: { raterType: string; total: number; submitted: number; /** True when written answers are held back because too few people answered. */ textsHeld: boolean; summary: QuestionSummary[] }[];
  result: {
    status: string;
    scorePercent: number | null;
    overallScore: number | null;
    grade: string | null;
    /** What the calculation gave when HR changed the score by hand; only HR are told, never managers or the employee. */
    adjustedFrom: number | null;
    types: { raterType: string; raters: number; percent: number; weightUsed: number }[];
  };
  /** Comments copied from another system for a round with no answer sheets; null when there are none. Already filtered for this viewer. */
  importedComments: CommentsView | null;
  /** HR only (null for everyone else): each submitted sheet that has written text, with the rater's name. */
  namedComments: { assignmentId: string; raterType: string; raterName: string; score: number | null; submittedAt: Date | null; texts: string[] }[] | null;
}

/**
 * Answers for one person, grouped by rater type. Only submitted answers are summarised, and nobody's
 * name is attached to what they wrote, except in `namedComments`, which only HR receive. Averages are plain means: no weighting, grade or overall score yet.
 */
export async function getParticipantResult(
  companyId: string,
  roundId: string,
  participantId: string,
  session: AccessClaims,
): Promise<ParticipantResult> {
  const viewable = await viewableEmployeeIds(companyId, session);
  const p = await prisma.appraisalParticipant.findFirst({
    where: { id: participantId, roundId, round: { companyId, deletedAt: null }, ...participantScope(viewable, session.employeeId) },
    select: {
      id: true,
      departmentName: true,
      employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true } },
      formId: true,
      resultStatus: true,
      scorePercent: true,
      overallScore: true,
      grade: true,
      scoreBreakdown: true,
      adjustedAt: true,
      originalScorePercent: true,
      importedComments: true,
      round: { select: { name: true, status: true, formSnapshot: true } },
      assignments: {
        select: { id: true, raterType: true, status: true, answers: true, submittedAt: true, rater: { select: { firstName: true, lastName: true, nickname: true } } },
        orderBy: { submittedAt: "asc" },
      },
    },
  });
  if (!p) throw NotFound("ไม่พบข้อมูล");
  const form = pickForm(p.round.formSnapshot as unknown as RoundSnapshot | null, p.formId);
  const questions = (form?.questions ?? []) as SnapQuestion[];
  const ratingMax = form?.ratingMax ?? 5;
  const types = [...new Set(p.assignments.map((a) => a.raterType))];
  const isHr = can(session.perms, "campaign:update");
  const ratingIds = new Set(questions.filter((q) => q.answerType === "RATING").map((q) => q.id));
  const textIds = new Set(questions.filter((q) => q.answerType === "SHORT_TEXT" || q.answerType === "PARAGRAPH").map((q) => q.id));
  // Who wrote what: only HR get names (the same people can already open each rater's sheet from the tracking table).
  const namedComments = isHr
    ? p.assignments
        .filter((a) => a.status === "SUBMITTED")
        .flatMap((a) => {
          const answers = Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : [];
          const texts = answers.filter((x) => textIds.has(x.questionId) && typeof x.value === "string" && x.value.trim()).map((x) => (x.value as string).trim());
          if (texts.length === 0) return [];
          const scores = answers.filter((x) => ratingIds.has(x.questionId) && typeof x.value === "number").map((x) => x.value as number);
          const score = scores.length ? Math.round((scores.reduce((t, v) => t + v, 0) / scores.length) * 10) / 10 : null;
          return [{ assignmentId: a.id, raterType: a.raterType, raterName: fullName(a.rater), score, submittedAt: a.submittedAt, texts }];
        })
    : null;
  return {
    participantId: p.id,
    name: fullName(p.employee),
    code: p.employee.employeeCode,
    department: p.departmentName ?? "ไม่ระบุแผนก",
    roundName: p.round.name,
    roundStatus: p.round.status,
    ratingMax,
    ratingLabels: form?.ratingLabels ?? null,
    result: {
      status: p.resultStatus,
      scorePercent: p.scorePercent,
      overallScore: p.overallScore,
      grade: p.grade,
      adjustedFrom: p.adjustedAt && isHr ? p.originalScorePercent : null,
      types: ((p.scoreBreakdown as unknown as { types?: { raterType: string; raters: number; percent: number; weightUsed: number }[] } | null)?.types ?? []),
    },
    importedComments: commentsFor(parseImportedComments(p.importedComments), isHr),
    namedComments,
    groups: types.map((t) => {
      const mine = p.assignments.filter((a) => a.raterType === t);
      const done = mine.filter((a) => a.status === "SUBMITTED");
      const textsHeld = holdsBackTexts(t, done.length, isHr);
      const summary = summarizeAnswers(questions, t, done.map((a) => (Array.isArray(a.answers) ? (a.answers as unknown as Answer[]) : [])), ratingMax);
      return {
        raterType: t,
        total: mine.length,
        submitted: done.length,
        textsHeld,
        // Scores stay (they are plain counts); what people wrote is dropped before it leaves the server.
        summary: textsHeld ? summary.map((s) => ({ ...s, texts: [], notes: [] })) : summary,
      };
    }),
  };
}

/** Submitted / total assignments per department of the people being evaluated, for the overview bars. */
export async function getRoundDepartmentProgress(companyId: string, id: string, session: AccessClaims) {
  const round = await prisma.appraisalRound.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
  if (!round) throw NotFound("ไม่พบรอบประเมิน");
  const scope = participantScope(await viewableEmployeeIds(companyId, session), session.employeeId);
  const rows = await prisma.appraisalAssignment.findMany({
    where: { participant: { roundId: id, ...scope } },
    select: { status: true, participant: { select: { departmentName: true } } },
  });
  const byDept = new Map<string, { submitted: number; total: number }>();
  for (const r of rows) {
    const name = r.participant.departmentName ?? "ไม่ระบุแผนก";
    const cur = byDept.get(name) ?? { submitted: 0, total: 0 };
    cur.total++;
    if (r.status === "SUBMITTED") cur.submitted++;
    byDept.set(name, cur);
  }
  return [...byDept.entries()]
    .map(([department, v]) => ({ department, ...v, percent: v.total ? Math.round((v.submitted / v.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent || a.department.localeCompare(b.department, "th"));
}

/* ───────────────────────────── Rater side ───────────────────────────── */

function requireEmployee(session: AccessClaims): string {
  return requireEmployeeId(session);
}

export async function listMyAssignments(companyId: string, session: AccessClaims) {
  if (!session.employeeId) return []; // no employee record: nothing to rate (was a 403 on every page, audit B3)
  const employeeId = requireEmployee(session);
  const rows = await prisma.appraisalAssignment.findMany({
    where: { raterEmployeeId: employeeId, participant: { round: { companyId, deletedAt: null, status: { in: ["OPEN", "CLOSED"] } } } },
    select: {
      id: true,
      raterType: true,
      status: true,
      participantId: true,
      participant: {
        select: {
          employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true } },
          round: { select: { id: true, name: true, status: true, endDate: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 300,
  });
  // Answer sheets copied from another system are history for HR to read, not work or records in the rater's own list.
  // Matched on the positive value: a "not equal" JSON filter would also drop every person whose score is not worked out yet.
  const copied = new Set(
    (
      await prisma.appraisalParticipant.findMany({
        where: { id: { in: rows.map((r) => r.participantId) }, scoreBreakdown: { path: ["source"], equals: "favpo-import" } },
        select: { id: true },
      })
    ).map((p) => p.id),
  );
  return rows.filter((r) => !copied.has(r.participantId)).map((r) => ({
    id: r.id,
    raterType: r.raterType,
    status: r.status,
    personName: fullName(r.participant.employee),
    personCode: r.participant.employee.employeeCode,
    roundId: r.participant.round.id,
    roundName: r.participant.round.name,
    roundStatus: r.participant.round.status,
    endIso: r.participant.round.endDate ? iso(r.participant.round.endDate) : null,
  }));
}

async function loadMine(companyId: string, session: AccessClaims, id: string) {
  const employeeId = requireEmployee(session);
  const a = await prisma.appraisalAssignment.findFirst({
    where: { id, raterEmployeeId: employeeId, participant: { round: { companyId, deletedAt: null } } },
    select: {
      id: true,
      raterType: true,
      status: true,
      answers: true,
      participant: {
        select: {
          formId: true,
          employeeId: true,
          employee: { select: { firstName: true, lastName: true, nickname: true, employeeCode: true, gender: true } },
          departmentName: true,
          positionName: true,
          round: { select: { id: true, name: true, status: true, endDate: true, formSnapshot: true } },
        },
      },
    },
  });
  if (!a) throw NotFound("ไม่พบงานประเมินนี้");
  const form = pickForm(a.participant.round.formSnapshot as unknown as RoundSnapshot | null, a.participant.formId);
  if (!form) throw BadRequest("รอบนี้ยังไม่พร้อม");
  return {
    a,
    snap: { ratingMax: form.ratingMax, ratingLabels: form.ratingLabels ?? null, noteAtLowest: !!form.noteAtLowest, questions: form.questions as SnapQuestion[] },
  };
}

export async function getMyAssignment(companyId: string, session: AccessClaims, id: string) {
  const { a, snap } = await loadMine(companyId, session, id);
  const photos = await avatarPaths([a.participant.employeeId]);
  return {
    id: a.id,
    raterType: a.raterType,
    status: a.status,
    personName: fullName(a.participant.employee),
    personCode: a.participant.employee.employeeCode,
    personGender: a.participant.employee.gender ?? null,
    personAvatarUrl: photos.get(a.participant.employeeId) ?? null,
    personRole: [a.participant.positionName, a.participant.departmentName].filter(Boolean).join(" · ") || null,
    roundName: a.participant.round.name,
    roundStatus: a.participant.round.status,
    endIso: a.participant.round.endDate ? iso(a.participant.round.endDate) : null,
    ratingMax: snap.ratingMax,
    ratingLabels: snap.ratingLabels,
    noteAtLowest: snap.noteAtLowest,
    questions: visibleQuestions(snap.questions, a.raterType),
    answers: (Array.isArray(a.answers) ? a.answers : []) as unknown as Answer[],
  };
}

/** Saves a draft, or submits when `submit` is true (every required question must be answered; a submitted form is final). */
export async function saveMyAnswers(
  companyId: string,
  session: AccessClaims,
  id: string,
  input: { answers: { questionId: string; value: unknown; note?: string }[]; submit: boolean },
  meta?: Meta,
) {
  const { a, snap } = await loadMine(companyId, session, id);
  if (a.participant.round.status !== "OPEN") throw BadRequest("รอบนี้ปิดแล้ว");
  if (a.status === "SUBMITTED") throw BadRequest("ส่งผลประเมินแล้ว แก้ไขไม่ได้");

  const answers = cleanAnswers(snap.questions, a.raterType, input.answers, snap.ratingMax);
  if (input.submit) {
    const missing = unansweredRequired(snap.questions, a.raterType, answers, { noteAtLowest: snap.noteAtLowest });
    if (missing.length) throw BadRequest(`ยังตอบไม่ครบ: ${missing.join(", ")}`);
  }
  // Guarded at write time too: a draft save that was already in flight must never undo a sheet that was just submitted.
  const saved = await prisma.appraisalAssignment.updateMany({
    where: { id, status: { not: "SUBMITTED" } },
    data: {
      answers: answers as unknown as Prisma.InputJsonValue,
      status: input.submit ? "SUBMITTED" : "IN_PROGRESS",
      startedAt: a.status === "PENDING" ? new Date() : undefined,
      submittedAt: input.submit ? new Date() : null,
    },
  });
  if (saved.count !== 1) throw BadRequest("ส่งผลประเมินแล้ว แก้ไขไม่ได้");
  if (input.submit) {
    await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_assignment.submit", entity: "AppraisalAssignment", entityId: id, ...meta });
  }
  return { id, status: input.submit ? "SUBMITTED" : "IN_PROGRESS", answered: answers.length };
}

/* ───────────────────────────── Reminders and daily job ───────────────────────────── */

/**
 * Messages every rater who still has unsubmitted work in an OPEN round (one message per rater),
 * skipping anyone already reminded within `minGapHours`. Returns how many raters were messaged.
 */
async function remindUnsubmitted(
  r: { id: string; companyId: string; name: string; endDate: Date | null; notifyLine: boolean },
  minGapHours: number,
): Promise<number> {
  const since = new Date(Date.now() - minGapHours * 3_600_000);
  const todo = await prisma.appraisalAssignment.findMany({
    where: {
      participant: { roundId: r.id },
      status: { not: "SUBMITTED" },
      notifiedAt: { not: null },
      OR: [{ remindedAt: null }, { remindedAt: { lt: since } }],
    },
    select: { id: true, raterEmployeeId: true, participantId: true },
  });
  const byRater = new Map<string, { ids: string[]; people: Set<string> }>();
  for (const a of todo) {
    const cur = byRater.get(a.raterEmployeeId) ?? { ids: [], people: new Set<string>() };
    cur.ids.push(a.id);
    cur.people.add(a.participantId);
    byRater.set(a.raterEmployeeId, cur);
  }
  const endText = r.endDate ? ` ปิดรอบวันที่ ${fmtDay(iso(r.endDate))}` : "";
  let reminded = 0;
  for (const [raterId, v] of byRater) {
    try {
      await createNotification(r.companyId, raterId, {
        title: `เตือน: ${r.name}`,
        body: `ยังเหลือ ${v.people.size} คนที่ต้องประเมิน${endText}`,
        category: "evaluation",
        link: "/appraisal/tasks",
        line: r.notifyLine,
      });
      await prisma.appraisalAssignment.updateMany({ where: { id: { in: v.ids } }, data: { remindedAt: new Date() } });
      reminded++;
    } catch {
      /* one failed reminder must not stop the rest */
    }
  }
  return reminded;
}

/** The "เตือนทุกคน" button: remind everyone who has not submitted, at most once an hour each. */
export async function remindAll(companyId: string, session: AccessClaims, id: string, meta?: Meta) {
  const r = await prisma.appraisalRound.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, companyId: true, name: true, endDate: true, notifyLine: true, status: true },
  });
  if (!r) throw NotFound("ไม่พบรอบประเมิน");
  if (r.status !== "OPEN") throw BadRequest("เตือนได้เฉพาะรอบที่เปิดอยู่");
  const reminded = await remindUnsubmitted(r, 1);
  await writeAudit({ companyId, actorUserId: session.sub, action: "appraisal_round.remind_all", entity: "AppraisalRound", entityId: id, after: { reminded }, ...meta });
  return { reminded };
}

/**
 * Run once a day by the cron route: opens scheduled rounds whose start day has come
 * (sending their invitations), then reminds raters who have not submitted yet when a
 * round closes within REMIND_BEFORE_DAYS. A rater is reminded at most once a day.
 */
export async function runRoundJobs() {
  const todayIso = iso(bangkokParts().dateUTC);
  const summary = { opened: 0, invitationsSent: 0, reminded: 0, draftsMade: 0, draftsNudged: 0, draftsFailed: 0 };

  // Recurring rounds first: a draft made today shows up in HR's bell this morning.
  // A failure here must not stop the invitations and reminders below, which people are waiting for.
  try {
    const drafts = await makeDueRecurringRounds(todayIso);
    summary.draftsMade = drafts.made;
    summary.draftsNudged = drafts.nudged;
    summary.draftsFailed = drafts.failed;
  } catch (e) {
    summary.draftsFailed++;
    console.error("recurring rounds step failed", e);
  }

  // Open rounds where some rater never got the invitation (the message failed on the start day): try those people again.
  // Reminders only reach people who were invited, so without this step they would hear nothing at all.
  const missed = await prisma.appraisalRound.findMany({
    where: { deletedAt: null, status: "OPEN", participants: { some: { assignments: { some: { notifiedAt: null } } } } },
    select: { id: true, companyId: true },
  });
  for (const r of missed) {
    try {
      const res = await sendInvitations(r.companyId, r.id);
      summary.invitationsSent += res.sent;
    } catch (e) {
      console.error("invitation retry failed for round", r.id, e);
    }
  }

  // One round failing must not stop the others from opening or being reminded.
  const due = await prisma.appraisalRound.findMany({
    where: { deletedAt: null, status: "SCHEDULED", startDate: { lte: new Date(`${todayIso}T00:00:00Z`) } },
    select: { id: true, companyId: true },
  });
  for (const r of due) {
    try {
      const res = await sendInvitations(r.companyId, r.id);
      summary.opened++;
      summary.invitationsSent += res.sent;
    } catch (e) {
      console.error("opening scheduled round failed", r.id, e);
    }
  }

  const open = await prisma.appraisalRound.findMany({
    where: { deletedAt: null, status: "OPEN", remind: true, endDate: { not: null } },
    select: { id: true, companyId: true, name: true, endDate: true, notifyLine: true },
  });
  for (const r of open) {
    if (!r.endDate || !shouldRemind(iso(r.endDate), todayIso)) continue;
    try {
      summary.reminded += await remindUnsubmitted(r, 20);
    } catch (e) {
      console.error("reminders failed for round", r.id, e);
    }
  }
  return summary;
}

export type { Match };
