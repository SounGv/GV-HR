/**
 * Proposals: what น้องวีบอท prepares for a person to confirm before anything is
 * sent or published. This file has no server or database imports on purpose, so
 * the card text and the input checks can be tested on their own
 * (scripts/check-ai-proposal.mjs) and the same types serve the chat screens.
 */

export type ProposalKind = "send_notification" | "create_announcement" | "assign_shifts" | "approve_requests" | "draft_evaluation_template" | "adjust_leave_quota";

export const PROPOSAL_KINDS: readonly ProposalKind[] = ["send_notification", "create_announcement", "assign_shifts", "approve_requests", "draft_evaluation_template", "adjust_leave_quota"];

/** Limits match the announcement form (features/announcement/schema.ts) so a card never promises what the page would refuse. */
export const PROPOSAL_LIMITS = { title: 200, body: 5000 } as const;

/** What the person sees on the card. */
export interface ProposalCard {
  /** Signed token; the confirm endpoint accepts nothing else. */
  token: string;
  kind: ProposalKind;
  icon: "bell" | "megaphone" | "calendar" | "clipboard" | "form";
  /** Small label above the title, e.g. "ประกาศถึงทุกคน". */
  kindLabel: string;
  title: string;
  rows: { label: string; value: string }[];
  /** The text that will be sent or published; null for cards that show a table instead. */
  preview: { title: string; body: string } | null;
  /** A summary table (for example one line per person). */
  table?: { head: string[]; rows: string[][] };
  /** The full list behind a "ดูครบทั้ง N รายการ" fold. */
  detail?: { label: string; head: string[]; rows: string[][] };
  /** Items left out of the card, with the reason for each. */
  skipped?: { title: string; items: string[] };
  /** One-line warning shown with a status icon, e.g. that sending cannot be undone. */
  note?: string;
  confirmLabel: string;
  /** Words for the result line after confirming, e.g. "ส่งแจ้งเตือนแล้ว ถึง 87 คน". */
  doneText: string;
}

/** What the signed token carries. */
export interface ProposalPayload {
  kind: ProposalKind;
  title: string;
  body: string;
  /** send_notification only: the model's target text ("all", a name or a code). */
  target?: string;
  /** Recipients when the card was drawn; confirm refuses if it has changed since. */
  count?: number;
  /** assign_shifts only: what the card promised, checked again before anything is written. */
  /** adjust_leave_quota only: what the card showed (year, and per person and type the entitlement before and after). */
  quota?: { year: number; items: { employeeId: string; type: "ANNUAL" | "SICK" | "PERSONAL"; before: number; after: number }[] };
  /** draft_evaluation_template only: the cleaned draft the card showed. */
  template?: Record<string, unknown>;
  /** approve_requests only: the requests the card listed, in order. */
  approve?: { items: { kind: "leave" | "correction"; id: string }[] };
  shift?: { templateId: string; employeeIds: string[]; dates: string[]; changing: number; replaced: number };
}

export type ProposalInputCheck = { ok: true; title: string; body: string; target?: string } | { ok: false; message: string };

/** Checks what the model asked for before a card is drawn. Returns Thai text the model can relay. */
export function checkProposalInput(kind: ProposalKind, raw: Record<string, unknown>): ProposalInputCheck {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!title) return { ok: false, message: "ยังไม่มีหัวข้อ ให้ถามผู้ใช้ว่าจะใช้หัวข้อว่าอะไร" };
  if (!body) return { ok: false, message: "ยังไม่มีเนื้อหา ให้ถามผู้ใช้ว่าจะแจ้งอะไร" };
  if (title.length > PROPOSAL_LIMITS.title) return { ok: false, message: `หัวข้อยาวเกิน ${PROPOSAL_LIMITS.title} ตัวอักษร ให้ย่อก่อน` };
  if (body.length > PROPOSAL_LIMITS.body) return { ok: false, message: `เนื้อหายาวเกิน ${PROPOSAL_LIMITS.body} ตัวอักษร ให้ย่อก่อน` };
  if (kind === "send_notification") {
    const target = typeof raw.target === "string" ? raw.target.trim() : "";
    if (!target) return { ok: false, message: "ยังไม่ระบุผู้รับ ให้ถามผู้ใช้ว่าจะส่งถึงใคร" };
    return { ok: true, title, body, target };
  }
  return { ok: true, title, body };
}

export const isAllTarget = (target: string | undefined) => (target ?? "").trim().toLowerCase() === "all";

/** Describes recipients on the card: a count for groups, the name for one person. */
export function recipientsText(count: number, names: string[], isAll: boolean): string {
  if (isAll) return `${count} คน (พนักงานที่ทำงานอยู่ทั้งหมดในขอบเขตของคุณ)`;
  if (count === 1 && names[0]) return names[0];
  const shown = names.slice(0, 5).join(", ");
  return count > 5 ? `${count} คน เช่น ${shown}` : `${count} คน: ${shown}`;
}

export function buildNotificationCard(
  token: string,
  p: { title: string; body: string },
  recipients: { count: number; names: string[]; isAll: boolean },
): ProposalCard {
  const { count } = recipients;
  return {
    token,
    kind: "send_notification",
    icon: "bell",
    kindLabel: recipients.isAll ? "แจ้งเตือนในแอปถึงทุกคน" : "แจ้งเตือนในแอป",
    title: recipients.isAll ? "ส่งแจ้งเตือนถึงทุกคน" : "ส่งแจ้งเตือน",
    rows: [
      { label: "ผู้รับ", value: recipientsText(count, recipients.names, recipients.isAll) },
      { label: "ช่องทาง", value: "แจ้งเตือนในแอปเท่านั้น (ไม่ส่ง LINE)" },
    ],
    preview: { title: p.title, body: p.body },
    note: "ส่งแล้วเรียกคืนไม่ได้ ผู้รับจะเห็นทันที",
    confirmLabel: `ยืนยัน ส่งถึง ${count} คน`,
    doneText: `ส่งแจ้งเตือนแล้ว ถึง ${count} คน`,
  };
}

export function buildAnnouncementCard(token: string, p: { title: string; body: string }, authorName: string, audience: number): ProposalCard {
  return {
    token,
    kind: "create_announcement",
    icon: "megaphone",
    kindLabel: "ประกาศถึงทุกคน",
    title: "เผยแพร่ประกาศ",
    rows: [
      { label: "ผู้รับ", value: `พนักงานทั้งหมดที่ทำงานอยู่ (${audience} คน)` },
      { label: "ช่องทาง", value: "แจ้งเตือนในแอป (LINE ส่งตามนโยบายที่ตั้งไว้)" },
      { label: "ผู้ลงชื่อ", value: authorName },
    ],
    preview: { title: p.title, body: p.body },
    note: "เผยแพร่แล้วทุกคนเห็นทันที ถ้าต้องการถอนให้ลบประกาศในหน้าประกาศ",
    confirmLabel: "ยืนยัน เผยแพร่ประกาศ",
    doneText: `เผยแพร่ประกาศแล้ว ถึง ${audience} คน`,
  };
}

/** What the model is told after a card is drawn. It must not claim the action happened. */
export const PROPOSAL_TOOL_RESULT =
  "เตรียมการ์ดยืนยันแล้ว ผู้ใช้จะเห็นการ์ดใต้ข้อความของคุณและต้องกดยืนยันเอง ตอนนี้ยังไม่ได้ส่งหรือเผยแพร่อะไร " +
  "ให้ตอบสั้นๆ ว่าเตรียมให้แล้ว ให้ตรวจข้อความและกดยืนยันในการ์ด ห้ามบอกว่าส่งหรือเผยแพร่เสร็จแล้ว และห้ามถามยืนยันซ้ำเป็นข้อความ";

export type ConfirmOutcome =
  | { status: "done"; message: string; /** A page to open next, e.g. the new draft form. */ href?: string; hrefLabel?: string }
  | { status: "already"; message: string }
  | { status: "refused"; message: string };
