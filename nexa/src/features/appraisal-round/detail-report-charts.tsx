"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The four charts of the executive overview in the detailed evaluation report: plain SVG in one blue family plus greys, with the
 * numbers written on the chart so nothing has to be read off an axis or a legend. Each chart measures the box it sits in and draws
 * itself at that width (labels stay 12px or more), with a narrower layout on a phone instead of a sideways scroll.
 */

const DEEP = "#0d47a1";
const AXIS = "#e4e7ec";
const NARROW = 460;

/** Gives its children the width of the box they are in (520 until measured, so the first paint matches the server). */
function Measured({ label, children }: { label: string; children: (width: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(520);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} role="img" aria-label={label} className="w-full">
      {children(w)}
    </div>
  );
}

/** Columns: how many people in each score band. The last band (full marks) is the deeper blue. */
export function DistributionChart({ bands }: { bands: { label: string; count: number }[] }) {
  return (
    <Measured label="กราฟแท่งการกระจายคะแนน">
      {(W) => {
        const narrow = W < NARROW;
        const H = 240;
        const L = 28;
        const Bm = 36;
        const Tp = 22;
        const max = Math.max(4, ...bands.map((b) => b.count));
        const slot = (W - L - 6) / bands.length;
        const bw = Math.min(56, slot * 0.7);
        const y = (v: number) => Tp + (H - Bm - Tp) * (1 - v / max);
        const step = max > 8 ? 4 : 2;
        const grid: number[] = [];
        for (let g = 0; g <= max; g += step) grid.push(g);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
            {grid.map((g) => (
              <g key={g}>
                <line x1={L} x2={W - 4} y1={y(g)} y2={y(g)} stroke={AXIS} />
                <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">
                  {g}
                </text>
              </g>
            ))}
            {bands.map((b, i) => {
              const cx = L + slot * i + slot / 2;
              const last = i === bands.length - 1;
              return (
                <g key={b.label}>
                  <rect x={cx - bw / 2} y={y(b.count)} width={bw} height={(H - Bm - Tp) * (b.count / max)} rx="2" fill={last ? DEEP : "#1976d2"} />
                  <text x={cx} y={y(b.count) - 6} textAnchor="middle" fontSize="14" fontWeight="700" className="fill-foreground">
                    {b.count}
                  </text>
                  <text x={cx} y={H - 14} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
                    {narrow ? b.label.replace("ต่ำกว่า ", "<") : b.label}
                  </text>
                </g>
              );
            })}
          </svg>
        );
      }}
    </Measured>
  );
}
