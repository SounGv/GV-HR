/**
 * Names for each score on an appraisal form's rating scale (pure, no imports;
 * checked by `node --experimental-strip-types scripts/check-rating-labels.mjs`).
 *
 * A form stores its own names in `AppraisalForm.ratingLabels`; a form saved
 * before this existed has none and keeps the system's original names, so a
 * round already opened never changes what raters saw.
 */

export interface RatingLabel {
  score: number;
  label: string;
}

/** One line on the rater's screen: score, name and (for the system set only) a short description. */
export interface RubricLine {
  score: number;
  label: string;
  desc: string | null;
}

/** The system's original 1–5 names, used when a form has none of its own. */
const SYSTEM_RUBRIC: RubricLine[] = [
  { score: 5, label: "ดีเยี่ยม", desc: "โดดเด่นกว่าที่คาดหวังมาก เป็นแบบอย่างให้ผู้อื่นได้" },
  { score: 4, label: "ดี", desc: "ทำได้สูงกว่าที่คาดหวัง" },
  { score: 3, label: "ปานกลาง", desc: "เป็นไปตามที่คาดหวัง" },
  { score: 2, label: "ต้องพัฒนา", desc: "ต่ำกว่าที่คาดหวัง ต้องปรับปรุง" },
  { score: 1, label: "ต้องปรับปรุงเร่งด่วน", desc: "ไม่เป็นไปตามที่คาดหวังอย่างมาก" },
];

/** Ready-made name sets HR can pick in the form builder. `hr` is the set HR sent (2026-11-11). */
export const LABEL_PRESETS = {
  hr: {
    name: "ชุดที่ HR กำหนด",
    labels: [
      { score: 1, label: "ปรับปรุง" },
      { score: 2, label: "พอใช้" },
      { score: 3, label: "ปานกลาง" },
      { score: 4, label: "ดี" },
      { score: 5, label: "ดีมาก" },
    ],
  },
  clear: {
    name: "ชุดไล่ระดับชัด",
    labels: [
      { score: 1, label: "ต้องปรับปรุง" },
      { score: 2, label: "พอใช้" },
      { score: 3, label: "ดี" },
      { score: 4, label: "ดีมาก" },
      { score: 5, label: "ดีเยี่ยม" },
    ],
  },
} as const satisfies Record<string, { name: string; labels: RatingLabel[] }>;

export type LabelPresetKey = keyof typeof LABEL_PRESETS;

/** The set a brand-new form starts with. */
export const DEFAULT_PRESET: LabelPresetKey = "hr";

/**
 * Reads a stored `ratingLabels` value: one non-empty name per score 1..ratingMax,
 * else null (bad or missing data falls back to the system names, never to a gap).
 */
export function parseRatingLabels(value: unknown, ratingMax: number): RatingLabel[] | null {
  if (!Array.isArray(value)) return null;
  const byScore = new Map<number, string>();
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const score = Number((v as { score?: unknown }).score);
    const label = String((v as { label?: unknown }).label ?? "").trim();
    if (Number.isInteger(score) && score >= 1 && score <= ratingMax && label) byScore.set(score, label);
  }
  if (byScore.size !== ratingMax) return null;
  return Array.from({ length: ratingMax }, (_, i) => ({ score: i + 1, label: byScore.get(i + 1)! }));
}

/** The lines a rater sees, best score first: the form's own names when it has them, else the system set. */
export function rubricFor(ratingMax: number, ratingLabels: unknown): RubricLine[] {
  const own = parseRatingLabels(ratingLabels, ratingMax);
  if (own) return [...own].reverse().map((l) => ({ score: l.score, label: l.label, desc: null }));
  return SYSTEM_RUBRIC.filter((r) => r.score <= ratingMax);
}

/** Which preset a stored set matches, or "custom" (null when the form uses the system names). */
export function presetOf(labels: RatingLabel[] | null): LabelPresetKey | "custom" | null {
  if (!labels) return null;
  for (const key of Object.keys(LABEL_PRESETS) as LabelPresetKey[]) {
    const p = LABEL_PRESETS[key].labels;
    if (p.length === labels.length && p.every((l, i) => l.label === labels[i].label)) return key;
  }
  return "custom";
}
