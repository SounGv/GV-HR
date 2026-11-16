const TICKS = 36;

/**
 * A half-circle gauge made of short bars, in the one teal: how many of the people sit at the top score.
 * The number and the words are in the picture and in its label, so it never relies on colour alone.
 *
 * @param percent 0 to 100, already rounded.
 * @param caption the words under the number, e.g. "ได้เต็ม 100%".
 */
export function ScoreGauge({ percent, caption }: { percent: number; caption: string }) {
  const size = 190;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const outer = size / 2 - 8;
  const inner = outer - 16;
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * TICKS);
  return (
    <svg viewBox={`0 0 ${size} ${size / 2 + 22}`} className="mx-auto w-full max-w-[190px]" role="img" aria-label={`${caption} ${percent}%`}>
      {Array.from({ length: TICKS }, (_, i) => {
        const a = Math.PI + (Math.PI * (i + 0.5)) / TICKS;
        return (
          <line
            key={i}
            x1={(cx + outer * Math.cos(a)).toFixed(1)}
            y1={(cy + outer * Math.sin(a)).toFixed(1)}
            x2={(cx + inner * Math.cos(a)).toFixed(1)}
            y2={(cy + inner * Math.sin(a)).toFixed(1)}
            strokeWidth={5}
            strokeLinecap="round"
            className={i < filled ? "stroke-primary" : "stroke-border"}
          />
        );
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={30} fontWeight={700} className="fill-foreground">
        {percent}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={12} className="fill-muted-foreground">
        {caption}
      </text>
    </svg>
  );
}
