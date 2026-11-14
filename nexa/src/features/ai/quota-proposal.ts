/**
 * The pure half of "น้องวีบอทปรับโควตาวันลา": checking what the model asked for, the before/after rows
 * and the confirmation card. No server or database imports, so scripts/check-ai-quota-proposal.mjs can
 * test it directly. The database half is src/lib/ai/quota-proposal.ts.
 *
 * Same rule as the existing entitlement page (features/leave/entitlement-service.ts): it sets how many days a
 * person is entitled to for a paid type and year, never touches the days already used, and is for HR only.
 * Company-wide quota policy is not touched here.
 */
import type { ProposalCard } from "./proposal";

/** One card changes at most this many person x type entries. */
export const MAX_QUOTA_ROWS = 100;
export const QUOTA_TYPES = ["ANNUAL", "SICK", "PERSONAL"] as const;
export type QuotaType = (typeof QUOTA_TYPES)[number];

const TYPE_LABEL: Record<QuotaType, string> = { ANNUAL: "ลาพักร้อน", SICK: "ลาป่วย", PERSONAL: "ลากิจ" };
export const quotaTypeLabel = (t: string) => TYPE_LABEL[t as QuotaType] ?? t;

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface QuotaChange {
  employee: string;
  type: QuotaType;
  totalDays: number;
}

export type QuotaInputCheck = { ok: true; year: number; changes: QuotaChange[] } | { ok: false; message: string };

/** Checks the model's list: type, days (0 to 365, one decimal) and the size; the same person and type twice keeps the last value. */
export function checkQuotaInput(raw: Record<string, unknown>, thisYear: number): QuotaInputCheck {
  const year = raw.year === undefined ? thisYear : raw.year;
  if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return { ok: false, message: "ปีไม่ถูกต้อง ให้ใช้ปี ค.ศ. เช่น 2026 หรือไม่ระบุเพื่อใช้ปีนี้" };
  }
  if (!Array.isArray(raw.changes) || raw.changes.length === 0) {
    return { ok: false, message: "ยังไม่ระบุว่าจะปรับของใคร ให้ถามผู้ใช้ว่าพนักงานคนไหน ประเภทลาอะไร กี่วัน" };
  }
  const byKey = new Map<string, QuotaChange>();
  for (const [i, r] of raw.changes.entries()) {
    const o = (r ?? {}) as Record<string, unknown>;
    const employee = typeof o.employee === "string" ? o.employee.trim() : "";
    if (!employee) return { ok: false, message: `รายการที่ ${i + 1} ไม่ระบุพนักงาน` };
    if (!(QUOTA_TYPES as readonly string[]).includes(o.type as string)) {
      return { ok: false, message: `รายการที่ ${i + 1} ประเภทลาไม่ถูกต้อง ใช้ได้ ANNUAL (พักร้อน) SICK (ป่วย) PERSONAL (กิจ) ส่วนลาไม่รับค่าจ้างไม่มีโควตา` };
    }
    const d = o.totalDays;
    if (typeof d !== "number" || !Number.isFinite(d) || d < 0 || d > 365 || Math.abs(d * 10 - Math.round(d * 10)) > 1e-9) {
      return { ok: false, message: `รายการที่ ${i + 1} จำนวนวันต้องเป็นตัวเลข 0 ถึง 365 ทศนิยมไม่เกิน 1 ตำแหน่ง` };
    }
    byKey.set(`${employee.toLowerCase()}|${o.type}`, { employee, type: o.type as QuotaType, totalDays: round1(d) });
  }
  const changes = [...byKey.values()];
  if (changes.length > MAX_QUOTA_ROWS) {
    return { ok: false, message: `การ์ดหนึ่งใบปรับได้ไม่เกิน ${MAX_QUOTA_ROWS} รายการ แต่ที่ขอมี ${changes.length} รายการ ให้แบ่งเป็นกลุ่มเล็กลง` };
  }
  return { ok: true, year, changes };
}

export interface QuotaRow {
  employeeId: string;
  name: string;
  type: QuotaType;
  /** Entitlement now (the company default when the person has no row yet). */
  before: number;
  after: number;
  used: number;
}

/** What is wrong with a row, as Thai text, or null when it can be applied. */
export function quotaRowProblem(r: Pick<QuotaRow, "before" | "after" | "used">): string | null {
  if (r.after < r.used) return `ใช้ไปแล้ว ${round1(r.used)} วัน โควตาที่ตั้งต้องไม่ต่ำกว่าวันที่ใช้ไป (ตั้งได้ตั้งแต่ ${round1(r.used)} วันขึ้นไป)`;
  if (round1(r.after) === round1(r.before)) return "โควตาเท่าเดิมอยู่แล้ว ไม่ต้องเปลี่ยน";
  return null;
}

const dayText = (n: number) => `${round1(n)} วัน`;
const changeText = (r: QuotaRow) => `${round1(r.before)} → ${dayText(r.after)}`;

export function buildQuotaCard(token: string, year: number, rows: QuotaRow[], skipped: string[]): ProposalCard {
  const n = rows.length;
  const lowered = rows.filter((r) => r.after < r.before);
  const same = new Set(rows.map((r) => `${r.type}|${r.after}`));
  const action =
    same.size === 1 ? `ตั้ง${quotaTypeLabel(rows[0].type)}เป็น ${dayText(rows[0].after)} เหมือนกันทั้ง ${n} รายการ` : "ตั้งจำนวนวันที่มีสิทธิ์ต่อปี (ไม่แตะวันที่ใช้ไปแล้ว)";
  return {
    token,
    kind: "adjust_leave_quota",
    icon: "calendar",
    kindLabel: "โควตาวันลา",
    title: `ปรับโควตา ${n} รายการ`,
    rows: [
      { label: "การกระทำ", value: action },
      { label: "ปี", value: String(year + 543) },
    ],
    preview: null,
    table: {
      head: ["ผู้ได้รับ", "ประเภท", `โควตาปี ${year + 543} ก่อน → หลัง`, "ใช้ไปแล้ว", "คงเหลือหลังปรับ"],
      rows: rows.map((r) => [r.name, quotaTypeLabel(r.type), changeText(r), dayText(r.used), dayText(r.after - r.used)]),
    },
    skipped: skipped.length > 0 ? { title: `ข้ามไว้ ${skipped.length} รายการ (ไม่อยู่ในการ์ด)`, items: skipped } : undefined,
    note:
      lowered.length > 0
        ? `${lowered.length} รายการโควตาลดลง (${lowered.map((r) => r.name).slice(0, 3).join(", ")}${lowered.length > 3 ? " ฯลฯ" : ""}) ตรวจว่าตั้งใจ การปรับถูกบันทึกประวัติพร้อมค่าก่อนและหลัง`
        : "การปรับถูกบันทึกประวัติพร้อมค่าก่อนและหลัง ถ้าต้องการย้อนต้องปรับกลับอีกครั้ง",
    confirmLabel: `ยืนยัน ปรับโควตา ${n} รายการ`,
    doneText: `ปรับโควตาแล้ว ${n} รายการ`,
  };
}
