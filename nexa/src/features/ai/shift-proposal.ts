/**
 * The pure half of "น้องวีบอทตั้งกะงาน": which dates a request covers, which rows would be
 * created or replaced, and the confirmation card. No server or database imports, so
 * scripts/check-ai-shift-proposal.mjs can test it directly. The database half is
 * src/lib/ai/shift-proposal.ts.
 */
import type { ProposalCard } from "./proposal";

/** One confirmation covers at most this many shift rows (people x dates). */
export const MAX_SHIFT_ROWS = 100;
/** Longest date span one request may cover. */
export const MAX_SPAN_DAYS = 62;
export const MAX_PEOPLE = 40;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
const WEEKDAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function parseDay(s: unknown): number | null {
  if (typeof s !== "string" || !ISO_DAY.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
  return t;
}

/** "อ 18 พ.ย." for a YYYY-MM-DD day. */
export function thaiDay(iso: string): string {
  const t = parseDay(iso);
  if (t === null) return iso;
  const d = new Date(t);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

/** "17 พ.ย. 2569 ถึง 21 พ.ย. 2569 (5 วัน)" style text for a sorted list of days. */
export function rangeText(dates: string[]): string {
  const full = (iso: string) => `${thaiDay(iso)} ${Number(iso.slice(0, 4)) + 543}`;
  if (dates.length === 1) return full(dates[0]);
  return `${full(dates[0])} ถึง ${full(dates[dates.length - 1])} (${dates.length} วัน)`;
}

export type DatesCheck = { ok: true; dates: string[] } | { ok: false; message: string };

/**
 * The days a request covers: an explicit `dates` list, or `from` to `to` (inclusive),
 * optionally limited to some weekdays (0 = Sunday ... 6 = Saturday). Sorted, no repeats.
 */
export function expandDates(input: { dates?: unknown; from?: unknown; to?: unknown; weekdays?: unknown }): DatesCheck {
  const days = new Set<string>();
  if (Array.isArray(input.dates) && input.dates.length > 0) {
    for (const d of input.dates) {
      if (parseDay(d) === null) return { ok: false, message: `วันที่ "${String(d)}" ไม่ถูกต้อง ต้องเป็นรูป YYYY-MM-DD` };
      days.add(d as string);
    }
  } else {
    const a = parseDay(input.from);
    const b = parseDay(input.to ?? input.from);
    if (a === null) return { ok: false, message: "ยังไม่ระบุวันที่ ให้ถามผู้ใช้ว่าจะตั้งกะวันไหน" };
    if (b === null) return { ok: false, message: `วันสิ้นสุด "${String(input.to)}" ไม่ถูกต้อง ต้องเป็นรูป YYYY-MM-DD` };
    if (b < a) return { ok: false, message: "วันสิ้นสุดอยู่ก่อนวันเริ่ม ให้ตรวจวันที่กับผู้ใช้" };
    if ((b - a) / DAY_MS + 1 > MAX_SPAN_DAYS) return { ok: false, message: `ช่วงวันที่ยาวเกิน ${MAX_SPAN_DAYS} วัน ให้แบ่งเป็นช่วงสั้นลง` };
    let only: Set<number> | null = null;
    if (input.weekdays !== undefined) {
      if (!Array.isArray(input.weekdays) || input.weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) {
        return { ok: false, message: "weekdays ต้องเป็นเลข 0 ถึง 6 (0 = อาทิตย์)" };
      }
      only = new Set(input.weekdays as number[]);
    }
    for (let t = a; t <= b; t += DAY_MS) {
      if (only && !only.has(new Date(t).getUTCDay())) continue;
      days.add(new Date(t).toISOString().slice(0, 10));
    }
  }
  if (days.size === 0) return { ok: false, message: "ไม่มีวันที่ตรงเงื่อนไข ให้ตรวจวันที่หรือวันในสัปดาห์กับผู้ใช้" };
  const sorted = [...days].sort();
  const span = (parseDay(sorted[sorted.length - 1])! - parseDay(sorted[0])!) / DAY_MS + 1;
  if (span > MAX_SPAN_DAYS) return { ok: false, message: `ช่วงวันที่ยาวเกิน ${MAX_SPAN_DAYS} วัน ให้แบ่งเป็นช่วงสั้นลง` };
  return { ok: true, dates: sorted };
}

export interface ShiftRow {
  employeeId: string;
  name: string;
  date: string;
  /** Shift the person already has that day, or null. */
  before: { templateId: string; name: string } | null;
  /** new = nothing there yet, replace = another shift there, same = already this shift (no write). */
  kind: "new" | "replace" | "same";
}

/** Every person x date pair, with what is there today. `existing` is keyed `${employeeId}|${date}`. */
export function planRows(
  people: { id: string; name: string }[],
  dates: string[],
  templateId: string,
  existing: Map<string, { templateId: string; name: string }>,
): ShiftRow[] {
  const rows: ShiftRow[] = [];
  for (const p of people) {
    for (const date of dates) {
      const before = existing.get(`${p.id}|${date}`) ?? null;
      rows.push({
        employeeId: p.id,
        name: p.name,
        date,
        before,
        kind: !before ? "new" : before.templateId === templateId ? "same" : "replace",
      });
    }
  }
  return rows;
}

export function countKinds(rows: ShiftRow[]) {
  const c = { new: 0, replace: 0, same: 0 };
  for (const r of rows) c[r.kind]++;
  return { created: c.new, replaced: c.replace, unchanged: c.same, changing: c.new + c.replace };
}

/** Checks the people x dates size before anything is looked up. */
export function checkSize(peopleCount: number, dateCount: number): string | null {
  if (peopleCount < 1) return "ยังไม่ระบุพนักงาน ให้ถามผู้ใช้ว่าจะตั้งกะให้ใคร";
  if (peopleCount > MAX_PEOPLE) return `ระบุพนักงานได้ไม่เกิน ${MAX_PEOPLE} คนต่อครั้ง ให้แบ่งเป็นกลุ่มเล็กลง`;
  const total = peopleCount * dateCount;
  if (total > MAX_SHIFT_ROWS) {
    return `ครั้งเดียวตั้งได้ไม่เกิน ${MAX_SHIFT_ROWS} รายการ แต่ที่ขอคือ ${total} รายการ (${peopleCount} คน x ${dateCount} วัน) ให้แบ่งเป็นกลุ่มเล็กลง เช่น ทีมละสัปดาห์ แล้วถามผู้ใช้ว่าจะเริ่มที่ไหน`;
  }
  return null;
}

const timeText = (t: { name: string; startTime: string; endTime: string; breakMinutes: number }) =>
  `${t.name} ${t.startTime}-${t.endTime}${t.breakMinutes > 0 ? ` (พัก ${t.breakMinutes} นาที)` : ""}`;

/** The card. Rows that already have this shift are listed but not counted as changes. */
export function buildShiftCard(
  token: string,
  template: { name: string; startTime: string; endTime: string; breakMinutes: number },
  rows: ShiftRow[],
): ProposalCard {
  const k = countKinds(rows);
  const people = [...new Set(rows.map((r) => r.name))];
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const effect = [`ใหม่ ${k.created} รายการ`, k.replaced > 0 ? `แทนกะเดิม ${k.replaced} รายการ` : "", k.unchanged > 0 ? `มีกะนี้อยู่แล้ว ${k.unchanged} รายการ (ไม่เปลี่ยน)` : ""]
    .filter(Boolean)
    .join(", ");

  const perPerson = people.map((name) => {
    const mine = rows.filter((r) => r.name === name);
    const c = countKinds(mine);
    const replaced = mine.filter((r) => r.kind === "replace").map((r) => `${thaiDay(r.date)} ${r.before?.name} → ${template.name}`);
    const parts = [`ใหม่ ${c.created}`, c.replaced > 0 ? `แทนกะเดิม ${c.replaced} (${replaced.join(", ")})` : "", c.unchanged > 0 ? `มีกะนี้อยู่แล้ว ${c.unchanged}` : ""].filter(Boolean);
    return [name, `${mine.length} วัน`, parts.join(", ")];
  });

  return {
    token,
    kind: "assign_shifts",
    icon: "calendar",
    kindLabel: "ตั้งกะงาน",
    title: `ตั้ง${template.name} ${k.changing} รายการ`,
    rows: [
      { label: "กะ", value: timeText(template) },
      { label: "ช่วงวันที่", value: rangeText(dates) },
      { label: "ผู้ได้กะ", value: `${people.length} คน รวม ${rows.length} รายการ` },
      { label: "ผลต่อกะเดิม", value: effect },
    ],
    preview: null,
    table: people.length > 1 || k.replaced > 0 ? { head: ["ชื่อ", "จำนวนวัน", "รายการ"], rows: perPerson } : undefined,
    detail:
      rows.length > 1
        ? {
            label: `ดูครบทั้ง ${rows.length} รายการ`,
            head: ["ชื่อ", "วันที่", "กะ (ก่อน → หลัง)"],
            rows: rows.map((r) => [r.name, thaiDay(r.date), r.kind === "same" ? `${template.name} (ไม่เปลี่ยน)` : `${r.before?.name ?? "ไม่มี"} → ${template.name}`]),
          }
        : undefined,
    note: k.replaced > 0 ? `${k.replaced} รายการจะแทนกะเดิมของคนนั้นในวันนั้น กะเดิมจะหายไป` : undefined,
    confirmLabel: `ยืนยัน ตั้งกะ ${k.changing} รายการ`,
    doneText: `ตั้งกะแล้ว ${k.changing} รายการ`,
  };
}
