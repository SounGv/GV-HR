export { scoreBand, bandTone } from "@/lib/scoring";

/**
 * Fallback competency set — only used when the org hasn't configured any
 * competencies yet (see the `Competency` model), and as the fixed column
 * set for the bulk CSV import template.
 */
export const COMPETENCIES = [
  "การทำงานเป็นทีม",
  "ความรับผิดชอบ",
  "การสื่อสาร",
  "คุณภาพงาน",
  "ความคิดริเริ่ม",
] as const;

/**
 * What each point on the shared 1–5 scale means — shown next to the score
 * inputs so raters don't have to guess a standard. Anchored to the same
 * thresholds as `scoreBand()`.
 */
export const SCORE_RUBRIC: { score: number; label: string; desc: string }[] = [
  { score: 5, label: "ดีเยี่ยม", desc: "โดดเด่นกว่าที่คาดหวังมาก เป็นแบบอย่างให้ผู้อื่นได้" },
  { score: 4, label: "ดี", desc: "ทำได้สูงกว่าที่คาดหวัง" },
  { score: 3, label: "ปานกลาง", desc: "เป็นไปตามที่คาดหวัง" },
  { score: 2, label: "ต้องพัฒนา", desc: "ต่ำกว่าที่คาดหวัง ต้องปรับปรุง" },
  { score: 1, label: "ต้องปรับปรุงเร่งด่วน", desc: "ไม่เป็นไปตามที่คาดหวังอย่างมาก" },
];

export interface Competency {
  name: string;
  score: number;
}

/** Overall score = mean of competency scores, on a 1–5 scale (2 dp). */
export function computeOverall(competencies: Competency[]): number {
  if (competencies.length === 0) return 0;
  const sum = competencies.reduce((s, c) => s + c.score, 0);
  return Math.round((sum / competencies.length) * 100) / 100;
}
