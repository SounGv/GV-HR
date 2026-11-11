/**
 * Ranks a monthly attendance report the way HR asks for it ("who missed,
 * was late and took leave most, most first"): absent days, then late days,
 * then leave days, all descending. People with no scan at all that month
 * are not "absent every day" — they most likely don't use the check-in app —
 * so they go to the bottom with a note instead of topping the list.
 */

export interface AttendanceRow {
  code: string;
  name: string;
  scheduled: number;
  present: number;
  rate: number;
  late: number;
  leave: number;
  absent: number;
}

export interface RankedRow extends AttendanceRow {
  rank: number | null;
  note: string;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/** Normalises one report row (values may arrive as strings) to numbers. */
export function toAttendanceRow(r: Record<string, unknown>): AttendanceRow {
  return {
    code: String(r.code ?? ""),
    name: String(r.name ?? ""),
    scheduled: n(r.scheduled),
    present: n(r.present),
    rate: n(r.rate),
    late: n(r.late),
    leave: n(r.leave),
    absent: n(r.absent),
  };
}

export function rankAttendance(rows: AttendanceRow[]): RankedRow[] {
  const noScans = (r: AttendanceRow) => r.present === 0 && r.late === 0 && r.leave === 0 && r.scheduled > 0;
  const tracked = rows.filter((r) => !noScans(r));
  const untracked = rows.filter(noScans);
  tracked.sort(
    (a, b) => b.absent - a.absent || b.late - a.late || b.leave - a.leave || a.name.localeCompare(b.name, "th"),
  );
  untracked.sort((a, b) => a.name.localeCompare(b.name, "th"));
  return [
    ...tracked.map((r, i) => ({ ...r, rank: i + 1, note: "" })),
    ...untracked.map((r) => ({ ...r, rank: null, note: "ไม่มีบันทึกสแกนเลย (อาจไม่ได้ใช้แอป) จึงไม่จัดอันดับ" })),
  ];
}
