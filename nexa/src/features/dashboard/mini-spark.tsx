/**
 * A tiny trend line for a card: the last few days of one number, smoothed, with a dot on today.
 * Drawn in the colour of the surrounding text, so it follows the card and light or dark mode. Not meant to be read for exact
 * values, so it is hidden from screen readers; the number beside it says the same thing in words.
 */
export function MiniSpark({ values, className }: { values: readonly number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - (v / max) * (h - 10)] as const);
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className ?? "h-7 w-full"} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* A zero-length stroke with round caps is a dot that stays round when the picture is stretched to the card. */}
      <path d={`M${last[0].toFixed(1)},${last[1].toFixed(1)} L${last[0].toFixed(1)},${last[1].toFixed(1)}`} stroke="currentColor" strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
