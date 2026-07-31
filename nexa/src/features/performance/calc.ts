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

/** Rating band derived from the overall score. */
export function scoreBand(score: number): string {
  if (score >= 4.5) return "ดีเยี่ยม";
  if (score >= 3.5) return "ดี";
  if (score >= 2.5) return "ปานกลาง";
  if (score >= 1.5) return "ต้องพัฒนา";
  return "ต้องปรับปรุงเร่งด่วน";
}

export function bandTone(band: string): "success" | "info" | "warning" | "danger" {
  switch (band) {
    case "ดีเยี่ยม":
      return "success";
    case "ดี":
      return "info";
    case "ปานกลาง":
      return "warning";
    default:
      return "danger";
  }
}
