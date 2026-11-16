type Floater = {
  kind: "glass" | "orb" | "bokeh" | "spark";
  left: number;
  size: number;
  drift: number;
  opacity: number;
  duration: number;
  delay: number;
};

/** A small seeded generator, so the server and the browser build the same dots (Math.random would differ and break hydration). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS: Floater["kind"][] = ["glass", "glass", "glass", "orb", "orb", "bokeh", "spark", "spark"];

const FLOATERS: Floater[] = (() => {
  const rnd = seeded(20261117);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  return Array.from({ length: 34 }, (_, i) => {
    const kind = KINDS[i % KINDS.length];
    const duration = between(16, 34);
    return {
      kind,
      left: between(0, 98),
      size: kind === "spark" ? between(8, 14) : kind === "glass" ? between(18, 64) : kind === "bokeh" ? between(36, 90) : between(8, 26),
      drift: between(-50, 50),
      opacity: kind === "bokeh" ? between(0.25, 0.5) : between(0.45, 0.9),
      duration,
      delay: -between(0, duration),
    };
  });
})();

/**
 * Soft bubbles, glowing orbs, lime bokeh and twinkling sparks drifting up the website sign-in hero, over a faint field of light dust.
 * Pure CSS (transform and opacity only) and decorative, so it is hidden from assistive tech and holds still when the device asks for less motion.
 */
export function LoginFloaters() {
  return (
    <>
      <div aria-hidden="true" className="lf-dust" />
      <div aria-hidden="true" className="lf-field">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className={`lf lf-${f.kind}`}
            style={
              {
                left: `${f.left.toFixed(1)}%`,
                width: f.kind === "spark" ? undefined : `${f.size.toFixed(0)}px`,
                height: f.kind === "spark" ? undefined : `${f.size.toFixed(0)}px`,
                "--lf-dx": `${f.drift.toFixed(0)}px`,
                "--lf-o": f.opacity.toFixed(2),
                animationDuration: f.kind === "spark" ? `${f.duration.toFixed(1)}s, 2.6s` : `${f.duration.toFixed(1)}s`,
                animationDelay: f.kind === "spark" ? `${f.delay.toFixed(1)}s, 0s` : `${f.delay.toFixed(1)}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}
