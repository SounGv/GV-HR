/**
 * Shared 1–5 rating-band logic — used by both the ad-hoc PerformanceReview
 * flow and the newer Evaluation Campaign flow so banding never drifts apart.
 */
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
