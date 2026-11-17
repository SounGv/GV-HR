/**
 * Which picture goes with a score on the rater's screen (Microsoft Fluent Emoji 3D, MIT, files in public/icons/score).
 * The top score is a trophy (a thumbs-up when the scale is only 1-3), the lowest a wrench ("can be improved", not a
 * sad face), and the ones between a thumbs-up, a neutral face or a seedling. Pure, so it is checked by
 * `node --experimental-strip-types scripts/check-score-icon.mjs`.
 */
export function scoreIconSrc(score: number, max: number) {
  if (score <= 1) return "/icons/score/wrench.png";
  if (score >= max) return max > 3 ? "/icons/score/trophy.png" : "/icons/score/thumbs-up.png";
  if (max >= 4 && score === max - 1) return "/icons/score/thumbs-up.png";
  if (max >= 5 && score === 2) return "/icons/score/seedling.png";
  return "/icons/score/neutral.png";
}
