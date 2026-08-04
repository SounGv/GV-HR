export { scoreBand, bandTone } from "@/lib/scoring";

/** Standard competency set assessed in every review (each scored 1–5). */
export const COMPETENCIES = [
  "การทำงานเป็นทีม",
  "ความรับผิดชอบ",
  "การสื่อสาร",
  "คุณภาพงาน",
  "ความคิดริเริ่ม",
] as const;

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
