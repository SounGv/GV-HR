/**
 * Pure rules for appraisal rounds: matching raters from the org chart, deciding
 * whether a round can open, and planning who gets which invitation.
 *
 * No imports and Bangkok calendar days as UTC-midnight dates, so it can be
 * checked with `node --experimental-strip-types scripts/check-appraisal-round.mjs`.
 */

export type RaterType = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";
export const RATER_TYPES: readonly RaterType[] = ["SELF", "MANAGER", "PEER", "SUBORDINATE"];

/** 90° = manager; 180° adds self; 270° adds peers; 360° adds subordinates. */
export const PRESETS: Record<"90" | "180" | "270" | "360", readonly RaterType[]> = {
  "90": ["MANAGER"],
  "180": ["MANAGER", "SELF"],
  "270": ["MANAGER", "SELF", "PEER"],
  "360": ["MANAGER", "SELF", "PEER", "SUBORDINATE"],
};

/** Peers picked automatically for one person: colleagues under the same manager, at most this many. */
export const PEER_LIMIT = 5;
/** A rater with more than this many people to rate is flagged for HR to look at. */
export const MAX_LOAD = 12;
/** Reminder goes out when the round closes within this many days. */
export const REMIND_BEFORE_DAYS = 2;

export interface RosterPerson {
  id: string;
  managerId: string | null;
  active: boolean;
}

export interface Match {
  participantId: string;
  raterId: string;
  raterType: RaterType;
}

export type ExceptionKind = "NO_MANAGER" | "NO_PEERS" | "NO_RATER" | "OVERLOADED";

export interface MatchException {
  kind: ExceptionKind;
  /** The participant (or, for OVERLOADED, the rater). */
  employeeId: string;
  detail?: number;
}

export interface MatchResult {
  matches: Match[];
  exceptions: MatchException[];
}

/**
 * Works out who rates whom from the reporting line. Raters must be active.
 * Manager: the person's manager. Peers: other people under the same manager
 * (stable order, up to PEER_LIMIT). Subordinates: the people who report to the
 * participant (people with no reports simply have none, which is normal).
 */
export function matchRaters(
  participantIds: readonly string[],
  roster: readonly RosterPerson[],
  types: readonly RaterType[],
): MatchResult {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const reportsOf = new Map<string, RosterPerson[]>();
  for (const p of roster) {
    if (!p.managerId) continue;
    reportsOf.set(p.managerId, [...(reportsOf.get(p.managerId) ?? []), p]);
  }
  const matches: Match[] = [];
  const exceptions: MatchException[] = [];
  const seen = new Set<string>();
  const add = (participantId: string, raterId: string, raterType: RaterType) => {
    const key = `${participantId}|${raterId}|${raterType}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ participantId, raterId, raterType });
  };

  for (const pid of participantIds) {
    const person = byId.get(pid);
    let count = 0;
    const before = matches.length;

    if (types.includes("SELF") && person?.active) add(pid, pid, "SELF");

    if (types.includes("MANAGER")) {
      const manager = person?.managerId ? byId.get(person.managerId) : undefined;
      if (manager?.active) add(pid, manager.id, "MANAGER");
      else exceptions.push({ kind: "NO_MANAGER", employeeId: pid });
    }

    if (types.includes("PEER")) {
      const peers = person?.managerId
        ? (reportsOf.get(person.managerId) ?? []).filter((p) => p.id !== pid && p.active).slice(0, PEER_LIMIT)
        : [];
      if (peers.length === 0) exceptions.push({ kind: "NO_PEERS", employeeId: pid });
      for (const peer of peers) add(pid, peer.id, "PEER");
    }

    if (types.includes("SUBORDINATE")) {
      for (const sub of reportsOf.get(pid) ?? []) if (sub.active) add(pid, sub.id, "SUBORDINATE");
    }

    count = matches.length - before;
    if (count === 0) exceptions.push({ kind: "NO_RATER", employeeId: pid });
  }

  const load = new Map<string, number>();
  for (const m of matches) if (m.raterId !== m.participantId) load.set(m.raterId, (load.get(m.raterId) ?? 0) + 1);
  for (const [raterId, n] of load) if (n > MAX_LOAD) exceptions.push({ kind: "OVERLOADED", employeeId: raterId, detail: n });

  return { matches, exceptions };
}

/** Selected perspectives must total 100. Returns the total and whether it is valid. */
export function perspectiveTotal(types: readonly RaterType[], weights: Partial<Record<RaterType, number>>) {
  const total = types.reduce((sum, t) => sum + (weights[t] ?? 0), 0);
  return { total, ok: types.length > 0 && total === 100 };
}

export interface RoundState {
  formPublished: boolean;
  participantCount: number;
  raterTypes: readonly RaterType[];
  weights: Partial<Record<RaterType, number>>;
  /** Participants who ended up with no rater at all after matching. */
  withoutRater: number;
  startIso: string | null;
  endIso: string | null;
}

export interface Check {
  key: "form" | "people" | "raters" | "schedule";
  ok: boolean;
  why: string;
}

/** The readiness list: a round can open only when every row is ok. */
export function roundChecks(s: RoundState): Check[] {
  const pers = perspectiveTotal(s.raterTypes, s.weights);
  return [
    { key: "form", ok: s.formPublished, why: "ยังไม่ได้เลือกแบบประเมินที่ใช้งานแล้ว" },
    { key: "people", ok: s.participantCount > 0, why: "ยังไม่ได้เลือกคนที่ถูกประเมิน" },
    {
      key: "raters",
      ok: pers.ok && s.withoutRater === 0,
      why:
        s.raterTypes.length === 0
          ? "ยังไม่ได้เลือกผู้ประเมิน"
          : !pers.ok
            ? `น้ำหนักผู้ประเมินรวม ${pers.total}% ต้องเป็น 100%`
            : `มี ${s.withoutRater} คนที่ยังไม่มีผู้ประเมิน`,
    },
    {
      key: "schedule",
      ok: !!(s.startIso && s.endIso && s.endIso >= s.startIso),
      why: !(s.startIso && s.endIso) ? "ยังไม่ได้เลือกวันเปิดและวันปิดรอบ" : "วันปิดต้องไม่ก่อนวันเปิด",
    },
  ];
}

/** Send the invitations now when the start day is today or past, otherwise wait for it. */
export const sendMode = (startIso: string, todayIso: string): "NOW" | "SCHEDULED" => (startIso <= todayIso ? "NOW" : "SCHEDULED");

export interface InvitationLine {
  raterId: string;
  /** How many different people this rater has to rate (a rater is messaged once, not once per person). */
  count: number;
}

export interface InvitationPlan {
  lines: InvitationLine[];
  total: number;
  withLine: number;
  appOnly: number;
  /** Raters with no login or no employee record: nothing can be delivered to them. */
  unreachable: number;
}

/** One message per rater. `lineOf`/`reachable` come from the employee records. */
export function planInvitations(
  matches: readonly Match[],
  lineLinked: ReadonlySet<string>,
  reachable: ReadonlySet<string>,
): InvitationPlan {
  const people = new Map<string, Set<string>>();
  for (const m of matches) {
    const set = people.get(m.raterId) ?? new Set<string>();
    set.add(m.participantId);
    people.set(m.raterId, set);
  }
  const lines = [...people.entries()].map(([raterId, set]) => ({ raterId, count: set.size }));
  const sendable = lines.filter((l) => reachable.has(l.raterId));
  return {
    lines,
    total: sendable.length,
    withLine: sendable.filter((l) => lineLinked.has(l.raterId)).length,
    appOnly: sendable.filter((l) => !lineLinked.has(l.raterId)).length,
    unreachable: lines.length - sendable.length,
  };
}

/** Should a reminder go out today for a round ending on `endIso`? Only in the last REMIND_BEFORE_DAYS days, never after it ends. */
export function shouldRemind(endIso: string, todayIso: string): boolean {
  const days = Math.round((Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
  return days >= 0 && days <= REMIND_BEFORE_DAYS;
}
