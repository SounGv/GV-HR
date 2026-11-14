/**
 * The pure half of "น้องวีบอทร่างแบบประเมิน": cleaning up what the model sent, the weights, and the
 * confirmation card. No server or database imports, so scripts/check-ai-template-proposal.mjs can test
 * it directly. The database half is src/lib/ai/template-proposal.ts.
 *
 * Scope on purpose: a DRAFT form only. It is not tied to any round and not published, so no existing
 * score changes; the weights and answer scales are a proposal that HR checks on the form page.
 * Grade bands, rater weights and anything tied to pay are never touched here.
 */
import type { ProposalCard } from "./proposal";

export const MAX_SECTIONS = 6;
export const MAX_QUESTIONS_PER_SECTION = 8;
export const MAX_QUESTIONS = 40;

export type DraftAnswerType = "NUMERIC" | "LETTER" | "CHOICE" | "YES_NO" | "LONG_TEXT" | "SHORT_TEXT";
const ANSWER_TYPES: readonly DraftAnswerType[] = ["NUMERIC", "LETTER", "CHOICE", "YES_NO", "LONG_TEXT", "SHORT_TEXT"];
const NON_SCORING = new Set<string>(["LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"]);

export interface DraftOption {
  value: string;
  label: string;
  score: number;
}
export interface DraftQuestion {
  text: string;
  helpText?: string;
  answerType: DraftAnswerType;
  options?: DraftOption[];
  weight: number;
  required: boolean;
}
export interface DraftSection {
  name: string;
  questions: DraftQuestion[];
}
export interface DraftTemplate {
  name: string;
  description?: string;
  evaluationType?: string;
  rationale?: string;
  sections: DraftSection[];
}

export const isScoring = (answerType: string) => !NON_SCORING.has(answerType);

/** n weights that are whole numbers, at least 1 and add up to exactly 100; the first ones get the remainder. */
export function spreadWeights(n: number): number[] {
  if (n < 1) return [];
  const base = Math.floor(100 / n);
  const extra = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export type NormalizeResult = { ok: true; draft: DraftTemplate; autoWeights: boolean } | { ok: false; message: string };

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t.slice(0, max);
};

/**
 * Turns the model's draft into a clean one: defaults for the answer scale, whole-number weights that
 * sum to 100. `defaults` gives the options for NUMERIC / LETTER / YES_NO (the system's own defaults).
 * Returns Thai text the model can act on when something is wrong.
 */
export function normalizeDraft(raw: Record<string, unknown>, defaults: (t: DraftAnswerType) => DraftOption[] | undefined): NormalizeResult {
  const name = str(raw.name, 200);
  if (!name) return { ok: false, message: "ยังไม่มีชื่อแบบประเมิน ให้ตั้งชื่อ หรือถามผู้ใช้" };
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return { ok: false, message: "ยังไม่มีหมวด ต้องมีอย่างน้อย 1 หมวด" };
  if (raw.sections.length > MAX_SECTIONS) return { ok: false, message: `หมวดเกิน ${MAX_SECTIONS} หมวด ให้รวมหมวดให้น้อยลง` };

  const sections: DraftSection[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const [si, rs] of raw.sections.entries()) {
    const so = (rs ?? {}) as Record<string, unknown>;
    const sname = str(so.name, 200);
    if (!sname) return { ok: false, message: `หมวดที่ ${si + 1} ไม่มีชื่อ` };
    if (!Array.isArray(so.questions) || so.questions.length === 0) return { ok: false, message: `หมวด "${sname}" ไม่มีข้อคำถาม ต้องมีอย่างน้อย 1 ข้อ` };
    if (so.questions.length > MAX_QUESTIONS_PER_SECTION) return { ok: false, message: `หมวด "${sname}" มีเกิน ${MAX_QUESTIONS_PER_SECTION} ข้อ ให้แยกหมวดหรือตัดข้อ` };
    const questions: DraftQuestion[] = [];
    for (const [qi, rq] of so.questions.entries()) {
      const qo = (rq ?? {}) as Record<string, unknown>;
      const where = `หมวด "${sname}" ข้อ ${qi + 1}`;
      const text = str(qo.text, 500);
      if (!text) return { ok: false, message: `${where} ไม่มีข้อความคำถาม` };
      const answerType = qo.answerType as DraftAnswerType;
      if (!ANSWER_TYPES.includes(answerType)) return { ok: false, message: `${where} answerType ไม่ถูกต้อง ใช้ได้: ${ANSWER_TYPES.join(", ")}` };

      let options: DraftOption[] | undefined;
      if (isScoring(answerType)) {
        if (Array.isArray(qo.options) && qo.options.length > 0) {
          const opts: DraftOption[] = [];
          for (const [oi, ro] of qo.options.entries()) {
            const oo = (ro ?? {}) as Record<string, unknown>;
            const label = str(oo.label, 120);
            const score = oo.score;
            if (!label || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
              return { ok: false, message: `${where} ตัวเลือกที่ ${oi + 1} ต้องมี label และ score เป็นตัวเลข 0-100` };
            }
            opts.push({ value: str(oo.value, 60) ?? `o${oi + 1}`, label, score });
          }
          if (opts.length < 2) return { ok: false, message: `${where} ต้องมีตัวเลือกอย่างน้อย 2 รายการ` };
          if (new Set(opts.map((o) => o.value)).size !== opts.length) return { ok: false, message: `${where} มีตัวเลือกซ้ำกัน` };
          options = opts;
        } else if (answerType === "CHOICE") {
          return { ok: false, message: `${where} เป็นแบบเลือกตอบ ต้องระบุตัวเลือกพร้อมคะแนน (options)` };
        } else {
          options = defaults(answerType);
        }
      }

      const key = `${text.toLowerCase()}|${answerType}`;
      if (seen.has(key)) return { ok: false, message: `${where} ซ้ำกับข้อก่อนหน้า ("${text}")` };
      seen.add(key);
      questions.push({ text, helpText: str(qo.helpText, 500), answerType, options, weight: typeof qo.weight === "number" ? qo.weight : NaN, required: qo.required !== false });
      total++;
    }
    sections.push({ name: sname, questions });
  }
  if (total > MAX_QUESTIONS) return { ok: false, message: `รวมเกิน ${MAX_QUESTIONS} ข้อ ให้ตัดให้เหลือไม่เกิน ${MAX_QUESTIONS} ข้อ` };

  const scoring = sections.flatMap((s) => s.questions).filter((q) => isScoring(q.answerType));
  if (scoring.length === 0) return { ok: false, message: "ต้องมีข้อที่ให้คะแนนอย่างน้อย 1 ข้อ (ไม่ใช่ข้อความอิสระทั้งหมด)" };

  const given = scoring.filter((q) => Number.isFinite(q.weight));
  let autoWeights = false;
  if (given.length === 0) {
    const w = spreadWeights(scoring.length);
    scoring.forEach((q, i) => (q.weight = w[i]));
    autoWeights = true;
  } else if (given.length !== scoring.length) {
    return { ok: false, message: "ระบุน้ำหนักไม่ครบ ให้ระบุทุกข้อที่ให้คะแนน หรือไม่ระบุเลยเพื่อให้ระบบแบ่งเท่าๆ กัน" };
  } else {
    if (scoring.some((q) => !Number.isInteger(q.weight) || q.weight < 1 || q.weight > 100)) {
      return { ok: false, message: "น้ำหนักแต่ละข้อต้องเป็นจำนวนเต็ม 1-100 (เป็นเปอร์เซ็นต์ของคะแนนรวม)" };
    }
    const sum = scoring.reduce((s, q) => s + q.weight, 0);
    if (sum !== 100) return { ok: false, message: `น้ำหนักรวมของข้อที่ให้คะแนนเป็น ${sum}% ต้องเท่ากับ 100% ให้ปรับ หรือไม่ระบุน้ำหนักเพื่อให้ระบบแบ่งเท่าๆ กัน` };
  }
  for (const q of sections.flatMap((s) => s.questions)) if (!isScoring(q.answerType)) q.weight = 1;

  return {
    ok: true,
    autoWeights,
    draft: { name, description: str(raw.description, 1000), evaluationType: str(raw.evaluationType, 60), rationale: str(raw.rationale, 2000), sections },
  };
}

/** How a question is answered, in words: "ระดับ 1-5", "ใช่/ไม่ใช่", "ตัวอักษร A-D", "เลือก 4 ตัวเลือก", "ข้อความอิสระ". */
export function answerLabel(q: Pick<DraftQuestion, "answerType" | "options">): string {
  switch (q.answerType) {
    case "NUMERIC": {
      const s = (q.options ?? []).map((o) => o.score);
      return s.length ? `ระดับ ${Math.min(...s)}-${Math.max(...s)}` : "ระดับคะแนน";
    }
    case "YES_NO":
      return "ใช่/ไม่ใช่";
    case "LETTER": {
      const o = q.options ?? [];
      return o.length ? `ตัวอักษร ${o[0].label}-${o[o.length - 1].label}` : "ตัวอักษร";
    }
    case "CHOICE":
      return `เลือก ${(q.options ?? []).length} ตัวเลือก`;
    case "SHORT_TEXT":
      return "ข้อความสั้น";
    default:
      return "ข้อความอิสระ";
  }
}

export function summarizeDraft(d: DraftTemplate) {
  const all = d.sections.flatMap((s) => s.questions);
  const scoring = all.filter((q) => isScoring(q.answerType));
  return { sections: d.sections.length, questions: all.length, scoring: scoring.length, freeText: all.length - scoring.length, weightTotal: scoring.reduce((s, q) => s + q.weight, 0) };
}

export const TEMPLATE_NOTE = "น้ำหนักและระดับคะแนนเป็นข้อเสนอจากน้องวีบอท ต้องให้ HR ตรวจและแก้ที่หน้าแบบประเมินก่อนเผยแพร่";

export function buildTemplateCard(token: string, d: DraftTemplate, autoWeights: boolean): ProposalCard {
  const s = summarizeDraft(d);
  const size = `${s.sections} หมวด ${s.questions} ข้อ` + (s.freeText > 0 ? ` (ให้คะแนน ${s.scoring} ข้อ, ข้อความอิสระ ${s.freeText} ข้อ)` : "");
  return {
    token,
    kind: "draft_evaluation_template",
    icon: "form",
    kindLabel: "แบบประเมิน",
    title: `ร่างแบบประเมิน ${d.name}`,
    rows: [
      { label: "ชื่อ", value: d.name },
      ...(d.evaluationType ? [{ label: "ประเภท", value: d.evaluationType }] : []),
      { label: "ขนาด", value: size },
      { label: "น้ำหนักรวม", value: autoWeights ? `${s.weightTotal}% (ระบบแบ่งเท่าๆ กันให้ ปรับได้ที่หน้าแบบประเมิน)` : `${s.weightTotal}%` },
      { label: "จะบันทึกเป็น", value: "ฉบับร่าง (ยังไม่ใช้กับรอบประเมินใด)" },
    ],
    preview: null,
    table: {
      head: ["หมวด", "ข้อ", "น้ำหนักรวม"],
      rows: d.sections.map((sec) => [sec.name, String(sec.questions.length), `${sec.questions.filter((q) => isScoring(q.answerType)).reduce((t, q) => t + q.weight, 0)}%`]),
    },
    detail: {
      label: `ดูครบทั้ง ${s.questions} ข้อ`,
      head: ["หมวด", "คำถาม", "วิธีตอบ", "น้ำหนัก"],
      rows: d.sections.flatMap((sec) => sec.questions.map((q) => [sec.name, q.text, answerLabel(q), isScoring(q.answerType) ? `${q.weight}%` : "ไม่นับคะแนน"])),
    },
    note: TEMPLATE_NOTE,
    confirmLabel: "ยืนยัน บันทึกเป็นฉบับร่าง",
    doneText: `บันทึกแบบประเมินฉบับร่างแล้ว ${s.sections} หมวด ${s.questions} ข้อ`,
  };
}
