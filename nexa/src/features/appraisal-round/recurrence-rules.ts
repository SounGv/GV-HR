/**
 * Rules of recurring rounds (pure, no imports; checked by
 * `node --experimental-strip-types scripts/check-appraisal-recurrence.mjs`).
 *
 * HR sets "every month, open on day 1, close on day 7" once. A round that opens in a month evaluates the period that just ended
 * (a round opening on 1 December is for November, one opening on 1 January is for the quarter or year that just closed).
 * The daily job makes each round as a DRAFT a few days before it opens; HR press open. Nothing here scores anyone.
 */

export type Frequency = "MONTHLY" | "QUARTERLY" | "YEARLY";
export const FREQUENCIES: readonly Frequency[] = ["MONTHLY", "QUARTERLY", "YEARLY"];
export const FREQUENCY_LABEL: Record<Frequency, string> = { MONTHLY: "รายเดือน", QUARTERLY: "รายไตรมาส", YEARLY: "รายปี" };

/** The draft is made this many days before the round opens (the owner's example in the mock). */
export const DRAFT_LEAD_DAYS = 3;
/** Days 1 to 28 only, so the day exists in every month. */
export const MIN_DAY = 1;
export const MAX_DAY = 28;
export const PRESET_KEYS = ["90", "180", "270", "360"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export interface RecurrenceConfig {
  frequency: Frequency;
  openDay: number;
  closeDay: number;
}

export interface Occurrence {
  /** Unique per recurrence, e.g. "2026-11" (month), "2026-Q4" (quarter) or "2026" (year): the period being evaluated. */
  periodKey: string;
  /** Text for {เดือน}: the month, the range of months, or "ทั้งปี". */
  monthText: string;
  /** Text for {ไตรมาส}: "1" to "4" for the quarter the period falls in. */
  quarterText: string;
  /** Text for {ปี}: the Buddhist year of the period. */
  yearText: string;
  startIso: string;
  endIso: string;
  /** From this day the draft may be made. */
  draftFromIso: string;
}

const START_MONTHS: Record<Frequency, readonly number[]> = {
  MONTHLY: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  QUARTERLY: [1, 4, 7, 10],
  YEARLY: [1],
};

/** The round that opens on `openDay` of month `m` in year `y`, and the period it is about. */
function occurrenceAt(cfg: RecurrenceConfig, y: number, m: number): Occurrence {
  const startIso = `${y}-${pad(m)}-${pad(cfg.openDay)}`;
  const endIso = `${y}-${pad(m)}-${pad(cfg.closeDay)}`;
  const base = { startIso, endIso, draftFromIso: addDays(startIso, -DRAFT_LEAD_DAYS) };
  if (cfg.frequency === "MONTHLY") {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    return { ...base, periodKey: `${py}-${pad(pm)}`, monthText: THAI_MONTHS[pm - 1]!, quarterText: String(Math.ceil(pm / 3)), yearText: String(py + 543) };
  }
  if (cfg.frequency === "QUARTERLY") {
    const q = m === 1 ? 4 : (m - 1) / 3; // opening in Jan, Apr, Jul, Oct covers Q4, Q1, Q2, Q3
    const py = m === 1 ? y - 1 : y;
    const first = (q - 1) * 3;
    return { ...base, periodKey: `${py}-Q${q}`, monthText: `${THAI_MONTHS[first]} ถึง ${THAI_MONTHS[first + 2]}`, quarterText: String(q), yearText: String(py + 543) };
  }
  return { ...base, periodKey: String(y - 1), monthText: "ทั้งปี", quarterText: "-", yearText: String(y - 1 + 543) };
}

/** Every occurrence that opens between two years, oldest first. */
export function occurrencesBetween(cfg: RecurrenceConfig, fromYear: number, toYear: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (let y = fromYear; y <= toYear; y++) for (const m of START_MONTHS[cfg.frequency]) out.push(occurrenceAt(cfg, y, m));
  return out;
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));

/** The next `count` rounds that have not finished yet (their close day is today or later). */
export function upcomingOccurrences(todayIso: string, cfg: RecurrenceConfig, count: number): Occurrence[] {
  const y = yearOf(todayIso);
  return occurrencesBetween(cfg, y - 1, y + 3)
    .filter((o) => o.endIso >= todayIso)
    .slice(0, count);
}

/** The rounds whose draft should exist by today: the draft window has opened and the round has not closed. */
export function dueOccurrences(todayIso: string, cfg: RecurrenceConfig): Occurrence[] {
  const y = yearOf(todayIso);
  return occurrencesBetween(cfg, y - 1, y + 1).filter((o) => o.draftFromIso <= todayIso && todayIso <= o.endIso);
}

/** Fills {เดือน} {ไตรมาส} {ปี} in the name pattern; anything else is left as typed. */
export function roundName(pattern: string, o: Occurrence): string {
  return pattern.replaceAll("{เดือน}", o.monthText).replaceAll("{ไตรมาส}", o.quarterText).replaceAll("{ปี}", o.yearText).trim().slice(0, 200);
}

export interface RecurrenceInput extends RecurrenceConfig {
  name: string;
  preset: string;
}

/** Why this setup cannot be saved, in words for HR; null when it is fine. */
export function checkRecurrence(i: RecurrenceInput): string | null {
  if (i.name.trim().length === 0) return "ใส่ชื่อรอบ";
  if (!FREQUENCIES.includes(i.frequency)) return "เลือกความถี่ของรอบ";
  const ok = (d: number) => Number.isInteger(d) && d >= MIN_DAY && d <= MAX_DAY;
  if (!ok(i.openDay) || !ok(i.closeDay)) return `วันเปิดและวันปิดต้องเป็นวันที่ ${MIN_DAY} ถึง ${MAX_DAY} ของเดือน`;
  if (i.closeDay < i.openDay) return "วันปิดต้องไม่ก่อนวันเปิด";
  if (!(PRESET_KEYS as readonly string[]).includes(i.preset)) return "เลือกผู้ประเมินว่าให้ใครประเมิน";
  return null;
}
