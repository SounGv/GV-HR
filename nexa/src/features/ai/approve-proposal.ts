/**
 * The pure half of "น้องวีบอทอนุมัติคำขอ": checking what the model asked for, the wording of each row,
 * the confirmation card and the result text. No server or database imports, so
 * scripts/check-ai-approve-proposal.mjs can test it directly. The database half is
 * src/lib/ai/approve-proposal.ts.
 *
 * Scope on purpose: approve only, and only leave that comes out of a quota (annual, sick, personal) and
 * attendance time corrections. Overtime and unpaid leave change pay, so they stay on their own pages
 * for a person (and HR) to decide one by one.
 */
import type { ProposalCard } from "./proposal";

/** One card approves at most this many requests. */
export const MAX_APPROVE = 20;

// Same text as thaiDay in shift-proposal.ts. Copied, not imported, because the check scripts run these files
// with plain Node, which cannot follow an extensionless import; scripts/check-ai-approve-proposal.mjs compares the two.
const WEEKDAY = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export function thaiDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

export type ApproveKind = "leave" | "correction";
export interface ApproveRef {
  kind: ApproveKind;
  id: string;
}

export type ApproveInputCheck = { ok: true; items: ApproveRef[] } | { ok: false; message: string };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the list the model sent. Overtime is refused here with a reason the model can relay. */
export function checkApproveInput(raw: unknown): ApproveInputCheck {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, message: "ยังไม่ระบุคำขอที่จะอนุมัติ ให้ใช้ list_pending_approvals ดูรายการก่อน แล้วส่ง id กับประเภทมา" };
  const seen = new Set<string>();
  const items: ApproveRef[] = [];
  for (const r of raw) {
    const o = (r ?? {}) as Record<string, unknown>;
    if (o.kind === "overtime") {
      return {
        ok: false,
        message: "OT อนุมัติผ่านน้องวีบอทไม่ได้ เพราะมีผลต่อค่าจ้าง (ต้องเลือกประเภทวันที่กำหนดอัตราจ่ายและให้ HR ยืนยัน) ให้บอกผู้ใช้ว่าอนุมัติที่หน้า OT ทีละรายการ",
      };
    }
    if ((o.kind !== "leave" && o.kind !== "correction") || typeof o.id !== "string" || !ID.test(o.id)) {
      return { ok: false, message: "รายการไม่ถูกต้อง แต่ละรายการต้องมี kind (leave หรือ correction) และ id จาก list_pending_approvals" };
    }
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    items.push({ kind: o.kind, id: o.id });
  }
  if (items.length > MAX_APPROVE) {
    return { ok: false, message: `การ์ดหนึ่งใบอนุมัติได้ไม่เกิน ${MAX_APPROVE} รายการ แต่ที่ขอมี ${items.length} รายการ ให้ถามผู้ใช้ว่าจะเลือกกลุ่มไหนก่อน เช่น เฉพาะลาป่วย หรือเฉพาะทีมใดทีมหนึ่ง` };
  }
  return { ok: true, items };
}

export interface ApproveRow {
  ref: ApproveRef;
  typeLabel: string;
  person: string;
  when: string;
  effect: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "คงเหลือ 30 → 29 วัน" */
export function remainingEffect(before: number, amount: number, unit: "วัน" | "ชม."): string {
  return `คงเหลือ ${round1(before)} → ${round1(before - amount)} ${unit}`;
}

/** "อ 18 พ.ย. (1 วัน)", "พ 19 พ.ย. ถึง พฤ 20 พ.ย. (2 วัน)", "ศ 21 พ.ย. (ครึ่งวันเช้า)", "จ 17 พ.ย. 09:00-11:00 (2 ชม.)". */
export function leaveWhen(r: {
  startDate: string;
  endDate: string;
  days: number;
  halfDay: boolean;
  halfDayPeriod?: string | null;
  unit: string;
  hours?: number | null;
  startTime?: string | null;
  endTime?: string | null;
}): string {
  if (r.unit === "HOUR") return `${thaiDay(r.startDate)} ${r.startTime ?? ""}-${r.endTime ?? ""} (${round1(r.hours ?? 0)} ชม.)`;
  const span = r.startDate === r.endDate ? thaiDay(r.startDate) : `${thaiDay(r.startDate)} ถึง ${thaiDay(r.endDate)}`;
  if (r.halfDay) return `${span} (ครึ่งวัน${r.halfDayPeriod === "MORNING" ? "เช้า" : r.halfDayPeriod === "AFTERNOON" ? "บ่าย" : ""})`;
  return `${span} (${round1(r.days)} วัน)`;
}

/** HH:mm in Bangkok (UTC+7) for a Date, or null. */
export function bangkokTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Date(d.getTime() + 7 * 3600000).toISOString().slice(11, 16);
}

export function correctionEffect(clockIn: Date | null | undefined, clockOut: Date | null | undefined): string {
  const a = bangkokTime(clockIn);
  const b = bangkokTime(clockOut);
  if (a && b) return `บันทึกเข้า ${a} ออก ${b}`;
  if (a) return `บันทึกเข้า ${a}`;
  if (b) return `บันทึกออก ${b}`;
  return "ไม่เปลี่ยนเวลา";
}

export const APPROVE_SKIP_REASON = {
  notFound: "ไม่พบคำขอนี้",
  notPending: "ถูกดำเนินการไปแล้ว",
  own: "เป็นคำขอของคุณเอง อนุมัติเองไม่ได้",
  notTeam: "ไม่ใช่ลูกทีมที่คุณดูแล",
  outOfScope: "อยู่นอกขอบเขตของคุณ",
  notQuotaLeave: "ไม่ใช่ลาที่หักโควตา (ลาไม่รับค่าจ้างและลาประเภทอื่นมีผลต่อค่าจ้าง ต้องให้ HR ยืนยัน ทำที่หน้าลา)",
  noPermission: "คุณไม่มีสิทธิ์อนุมัติคำขอประเภทนี้",
} as const;

export function insufficientReason(remaining: number, asked: number, unit: "วัน" | "ชม."): string {
  return `${unit === "วัน" ? "วัน" : "ชั่วโมง"}ลาคงเหลือไม่พอ (เหลือ ${round1(remaining)} ${unit} ขอ ${round1(asked)} ${unit})`;
}

export function buildApproveCard(token: string, rows: ApproveRow[], skipped: string[]): ProposalCard {
  const n = rows.length;
  return {
    token,
    kind: "approve_requests",
    icon: "clipboard",
    kindLabel: "อนุมัติคำขอ",
    title: `อนุมัติ ${n} รายการ`,
    rows: [
      { label: "การกระทำ", value: `อนุมัติ (เหมือนกันทั้ง ${n} รายการ)` },
      { label: "ลำดับ", value: "ทำทีละรายการ ถ้ารายการไหนติดขัดจะหยุดทันที" },
    ],
    preview: null,
    table: { head: ["ประเภท", "ผู้ขอ", "วันที่", "เมื่ออนุมัติ"], rows: rows.map((r) => [r.typeLabel, r.person, r.when, r.effect]) },
    skipped: skipped.length > 0 ? { title: `ข้ามไว้ ${skipped.length} รายการ (ไม่อยู่ในการ์ด)`, items: skipped } : undefined,
    note: "อนุมัติแล้วระบบหักวันลา (ถ้ามี) และส่งแจ้งเตือนถึงผู้ขอทันที",
    confirmLabel: `ยืนยัน อนุมัติ ${n} รายการ`,
    doneText: `อนุมัติแล้ว ${n} รายการ`,
  };
}

/** Result text when the run stopped part way: what was done, where it stopped and why. */
export function stoppedText(done: number, total: number, failedAt: number, failedLabel: string, reason: string): string {
  const rest = total - done - 1;
  return (
    `อนุมัติแล้ว ${done} จาก ${total} รายการ แล้วหยุดที่รายการที่ ${failedAt} (${failedLabel}): ${reason}. ` +
    `${done > 0 ? `${done} รายการแรกอนุมัติเรียบร้อยและยังคงอนุมัติ` : "ยังไม่มีรายการไหนถูกอนุมัติ"}` +
    `${rest > 0 ? ` อีก ${rest} รายการหลังจากนั้นยังไม่ได้ทำ` : ""} ให้ขอน้องวีบอทตรวจรายการที่เหลือใหม่`
  );
}
