/**
 * The quick actions of น้องวีบอท: questions and commands answered from our own data with no AI, so they are free,
 * instant and never leave the system. This file has the list, the short-command reader and the plain-text form of
 * an answer. The work itself is src/lib/ai/quick.ts. No imports, so scripts/check-ai-quick.mjs can test it directly.
 */

export type QuickAction =
  | "late_today"
  | "absent_today"
  | "pending_approvals"
  | "leave_quota"
  | "shifts_week"
  | "eval_progress"
  | "announce"
  | "notify";

export const QUICK_ACTIONS: { id: QuickAction; label: string; icon: "clock" | "users" | "clip" | "cal" | "chart" | "mega" | "bell"; needs: "none" | "name" | "form" }[] = [
  { id: "late_today", label: "ใครมาสายวันนี้", icon: "clock", needs: "none" },
  { id: "absent_today", label: "ใครขาดวันนี้", icon: "users", needs: "none" },
  { id: "pending_approvals", label: "มีอะไรรออนุมัติ", icon: "clip", needs: "none" },
  { id: "leave_quota", label: "โควตาวันลาของ…", icon: "cal", needs: "name" },
  { id: "shifts_week", label: "ตารางกะสัปดาห์นี้", icon: "cal", needs: "none" },
  { id: "eval_progress", label: "ความคืบหน้ารอบประเมิน", icon: "chart", needs: "none" },
  { id: "announce", label: "ส่งประกาศ", icon: "mega", needs: "form" },
  { id: "notify", label: "ส่งแจ้งเตือน", icon: "bell", needs: "form" },
];

export interface QuickCommand {
  action: QuickAction;
  /** The person named in "โควตา สมชาย". */
  name?: string;
  /** What followed "ประกาศ" or "แจ้งเตือน", offered as the title of the form. */
  title?: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Polite and filler words that do not change what is asked. Longest first, so "มีอะไร" goes before "มี". */
const FILLERS = ["ถึงไหนแล้ว", "ถึงไหน", "แล้ว", "สัปดาห์นี้", "ทั้งหมด", "ตอนนี้", "วันนี้", "หรือเปล่า", "มีอะไร", "ขอดู", "กี่คน", "บ้าง", "ไหม", "เปล่า", "ครับ", "ค่ะ", "คะ", "นะ", "หน่อย", "เช็กดู", "เช็คดู", "เช็ก", "เช็ค", "ดู", "ใคร", "มี", "คำขอ", "รายการ", "การ", "ที่"];

/** Exactly what is left once the filler words are gone. Anything else (a name, another topic) is not understood. */
const CORES: Record<string, QuickAction> = {
  มาสาย: "late_today",
  สาย: "late_today",
  ขาด: "absent_today",
  ขาดงาน: "absent_today",
  ไม่มา: "absent_today",
  ไม่มาทำงาน: "absent_today",
  รออนุมัติ: "pending_approvals",
  รอฉันอนุมัติ: "pending_approvals",
  ต้องอนุมัติ: "pending_approvals",
  อนุมัติ: "pending_approvals",
  ตารางกะ: "shifts_week",
  กะ: "shifts_week",
  กะงาน: "shifts_week",
  ความคืบหน้ารอบประเมิน: "eval_progress",
  ความคืบหน้าประเมิน: "eval_progress",
  รอบประเมิน: "eval_progress",
  ประเมิน: "eval_progress",
};

/**
 * Reads a short typed command. Only the phrasings below are understood: anything else returns null, never a guess,
 * so the fallback says it does not understand instead of answering the wrong question. A sentence that merely
 * contains a keyword ("ใบลาของสมชายที่รออนุมัติ") is not a command.
 */
export function parseQuickCommand(raw: string): QuickCommand | null {
  const t = clean(raw);
  if (!t || t.length > 120) return null;

  const quota = /^(?:โควตา(?:วันลา)?|วันลาคงเหลือ|วันลาเหลือ|เช็คโควตา|ดูโควตา)\s*(?:ของ\s*)?(.*)$/.exec(t);
  if (quota) {
    const name = clean(quota[1] ?? "");
    return name ? { action: "leave_quota", name } : { action: "leave_quota" };
  }
  const announce = /^(?:ส่ง|สร้าง|ลง)?ประกาศ(?:\s+(.*))?$/.exec(t);
  if (announce) return announce[1] ? { action: "announce", title: clean(announce[1]) } : { action: "announce" };
  const notify = /^(?:ส่ง)?แจ้งเตือน(?:ทุกคน)?(?:\s+(.*))?$/.exec(t);
  if (notify) return notify[1] ? { action: "notify", title: clean(notify[1]) } : { action: "notify" };

  let core = t.replace(/\s+/g, "");
  for (const f of FILLERS) core = core.split(f).join("");
  const action = CORES[core];
  return action ? { action } : null;
}

/** What a quick action returns, ready to show as an answer. */
export interface QuickResultBody {
  text: string;
  table?: { head: string[]; rows: string[][] };
  /** Shown after the table, e.g. "แสดง 20 จาก 34 คน". */
  note?: string;
}

/** A line under every local answer, so people can see it did not use the AI. */
export const LOCAL_SOURCE_LINE = "ตอบจากข้อมูลในระบบ ไม่ใช้ AI ไม่มีข้อมูลออกนอกระบบ";

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\r?\n/g, " ");

/** The answer as Markdown, the form the chat already shows (headings, tables). */
export function quickToMarkdown(r: QuickResultBody): string {
  const parts = [r.text];
  if (r.table && r.table.rows.length > 0) {
    const head = `| ${r.table.head.map(cell).join(" | ")} |`;
    const sep = `| ${r.table.head.map(() => "---").join(" | ")} |`;
    const rows = r.table.rows.map((row) => `| ${row.map(cell).join(" | ")} |`);
    parts.push([head, sep, ...rows].join("\n"));
  }
  if (r.note) parts.push(r.note);
  parts.push(`*${LOCAL_SOURCE_LINE}*`);
  return parts.join("\n\n");
}

/** At most this many rows on screen; the real total is said in the note. */
export const QUICK_MAX_ROWS = 20;

export function rowsNote(shown: number, total: number, unit: string): string | undefined {
  return total > shown ? `แสดง ${shown} จาก ${total} ${unit}` : undefined;
}
