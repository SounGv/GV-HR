/**
 * The arithmetic behind the evaluation section of the home page: who is still waiting, how far a round has got,
 * and the average, grade spread and ranking of results HR has already approved. It only reads numbers that exist;
 * the score formula, weights and grade bands stay where HR set them. No imports, so
 * scripts/check-evaluation-overview.mjs can test it directly.
 */

export type AssignmentState = "PENDING" | "IN_PROGRESS" | "SUBMITTED";

export interface AssignmentLite {
  raterType: string;
  status: AssignmentState;
}

export interface ParticipantLite {
  employeeId: string;
  name: string;
  department: string;
  assignments: AssignmentLite[];
}

export const RATER_LABEL: Record<string, string> = {
  SELF: "ตนเอง",
  MANAGER: "หัวหน้า",
  PEER: "เพื่อนร่วมงาน",
  SUBORDINATE: "ลูกน้อง",
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export interface RoundSummary {
  people: { total: number; done: number; pending: number };
  forms: { total: number; submitted: number; inProgress: number; notStarted: number; percentSubmitted: number };
  byRater: { raterType: string; label: string; pending: number; total: number }[];
  byDepartment: { department: string; pending: number; total: number; percentSubmitted: number }[];
  pendingPeople: { employeeId: string; name: string; department: string; waiting: string; submitted: number; total: number }[];
}

/** "หัวหน้า, เพื่อนร่วมงาน 2 คน": who has not sent their form for this person yet. */
export function waitingText(assignments: AssignmentLite[]): string {
  const waiting = assignments.filter((a) => a.status !== "SUBMITTED");
  const order = ["SELF", "MANAGER", "PEER", "SUBORDINATE"];
  const parts: string[] = [];
  for (const type of order) {
    const n = waiting.filter((a) => a.raterType === type).length;
    if (n === 0) continue;
    const label = RATER_LABEL[type] ?? type;
    parts.push(n > 1 ? `${label} ${n} คน` : label);
  }
  return parts.join(", ");
}

/** A person counts as done only when every rater has submitted; someone with no rater at all is still waiting. */
export const isDone = (p: ParticipantLite) => p.assignments.length > 0 && p.assignments.every((a) => a.status === "SUBMITTED");

export function summarizeRound(participants: ParticipantLite[], maxPending = 5): RoundSummary {
  const all = participants.flatMap((p) => p.assignments);
  const submitted = all.filter((a) => a.status === "SUBMITTED").length;
  const inProgress = all.filter((a) => a.status === "IN_PROGRESS").length;
  const done = participants.filter(isDone).length;

  const raterTypes = [...new Set(all.map((a) => a.raterType))].sort((a, b) => Object.keys(RATER_LABEL).indexOf(a) - Object.keys(RATER_LABEL).indexOf(b));
  const byRater = raterTypes.map((raterType) => {
    const mine = all.filter((a) => a.raterType === raterType);
    return { raterType, label: RATER_LABEL[raterType] ?? raterType, pending: mine.filter((a) => a.status !== "SUBMITTED").length, total: mine.length };
  });

  const depts = new Map<string, ParticipantLite[]>();
  for (const p of participants) depts.set(p.department, [...(depts.get(p.department) ?? []), p]);
  const byDepartment = [...depts.entries()]
    .map(([department, list]) => {
      const forms = list.flatMap((p) => p.assignments);
      return {
        department,
        pending: list.filter((p) => !isDone(p)).length,
        total: list.length,
        percentSubmitted: pct(forms.filter((a) => a.status === "SUBMITTED").length, forms.length),
      };
    })
    .sort((a, b) => b.pending - a.pending || a.department.localeCompare(b.department, "th"));

  const pendingPeople = participants
    .filter((p) => !isDone(p))
    .map((p) => ({
      row: {
        employeeId: p.employeeId,
        name: p.name,
        department: p.department,
        waiting: p.assignments.length === 0 ? "ยังไม่มีผู้ประเมิน" : waitingText(p.assignments),
        submitted: p.assignments.filter((a) => a.status === "SUBMITTED").length,
        total: p.assignments.length,
      },
      left: p.assignments.filter((a) => a.status !== "SUBMITTED").length,
    }))
    .sort((a, b) => b.left - a.left || a.row.name.localeCompare(b.row.name, "th"))
    .slice(0, maxPending)
    .map((x) => x.row);

  return {
    people: { total: participants.length, done, pending: participants.length - done },
    forms: { total: all.length, submitted, inProgress, notStarted: all.length - submitted - inProgress, percentSubmitted: pct(submitted, all.length) },
    byRater,
    byDepartment,
    pendingPeople,
  };
}

export interface ResultRow {
  employeeId: string;
  name: string;
  department: string;
  scorePercent: number;
  grade: string | null;
}

export interface ResultSummary {
  count: number;
  average: number;
  grades: { label: string; count: number }[];
  departments: { department: string; average: number; count: number }[];
  /** Best first. People with the same score share a rank and the next rank is skipped (1, 2, 2, 4). */
  top: { rank: number; name: string; department: string; scorePercent: number; grade: string | null }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param gradeOrder grade labels best first (from HR's bands), so the spread reads A, B, C instead of alphabetical.
 * @param topN how many ranked rows to return.
 */
export function summarizeResults(rows: ResultRow[], gradeOrder: string[], topN = 5): ResultSummary | null {
  if (rows.length === 0) return null;
  const average = round1(rows.reduce((s, r) => s + r.scorePercent, 0) / rows.length);

  const counts = new Map<string, number>();
  for (const r of rows) if (r.grade) counts.set(r.grade, (counts.get(r.grade) ?? 0) + 1);
  const grades = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const ia = gradeOrder.indexOf(a.label);
      const ib = gradeOrder.indexOf(b.label);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.label.localeCompare(b.label, "th");
    });

  const depts = new Map<string, number[]>();
  for (const r of rows) depts.set(r.department, [...(depts.get(r.department) ?? []), r.scorePercent]);
  const departments = [...depts.entries()]
    .map(([department, list]) => ({ department, average: round1(list.reduce((s, n) => s + n, 0) / list.length), count: list.length }))
    .sort((a, b) => b.average - a.average || a.department.localeCompare(b.department, "th"));

  const sorted = [...rows].sort((a, b) => b.scorePercent - a.scorePercent || a.name.localeCompare(b.name, "th"));
  const top: ResultSummary["top"] = [];
  sorted.slice(0, topN).forEach((r, i) => {
    const rank = i > 0 && r.scorePercent === sorted[i - 1]!.scorePercent ? top[i - 1]!.rank : i + 1;
    top.push({ rank, name: r.name, department: r.department, scorePercent: round1(r.scorePercent), grade: r.grade });
  });

  return { count: rows.length, average, grades, departments, top };
}

export interface AverageChange {
  /** Points of percent, one decimal, current minus previous. */
  delta: number;
  direction: "up" | "down" | "same";
}

/** How the average moved since the previous approved round. A move under 0.05 point reads as "same". */
export function compareAverages(current: number, previous: number): AverageChange {
  const delta = round1(current - previous);
  return { delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "same" };
}
