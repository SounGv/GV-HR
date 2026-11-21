"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The four charts of the executive overview in the detailed evaluation report: plain SVG in one blue family plus greys, with the
 * numbers written on the chart so nothing has to be read off an axis or a legend. Each chart measures the box it sits in and draws
 * itself at that width (labels stay 12px or more), with a narrower layout on a phone instead of a sideways scroll.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const DEEP = "#0d47a1";
const SOFT = "#90caf9";
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

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

/** One bar per team from zero to 100, with the company average as a dashed line. Teams at or above it are the deeper blue. */
export function TeamBars({ teams, company }: { teams: { name: string; count: number; avg: number }[]; company: number }) {
  return (
    <Measured label="กราฟแท่งค่าเฉลี่ยรายทีมเทียบทั้งบริษัท">
      {(W) => {
        const narrow = W < NARROW;
        const rowH = narrow ? 58 : 40;
        const L = narrow ? 6 : 190;
        const R = narrow ? 52 : 60;
        const Tp = 28;
        const H = Tp + teams.length * rowH + 22;
        const aw = W - L - R;
        const x = (v: number) => L + aw * (v / 100);
        return (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
              {[0, 25, 50, 75, 100].map((g) => (
                <g key={g}>
                  <line x1={x(g)} x2={x(g)} y1={Tp - 6} y2={H - 22} stroke={AXIS} />
                  <text x={x(g)} y={H - 6} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
                    {g}
                  </text>
                </g>
              ))}
              {teams.map((t, i) => {
                const y = Tp + i * rowH;
                return (
                  <g key={t.name}>
                    <title>{t.name}</title>
                    {narrow ? (
                      <text x={L} y={y + 13} fontSize="13" className="fill-foreground">
                        {cut(t.name, 34)}
                        <tspan className="fill-muted-foreground" fontSize="12">{`  ${t.count} คน`}</tspan>
                      </text>
                    ) : (
                      <>
                        <text x={L - 8} y={y + 19} textAnchor="end" fontSize="13" className="fill-foreground">
                          {cut(t.name, 26)}
                        </text>
                        <text x={L - 8} y={y + 34} textAnchor="end" fontSize="12" className="fill-muted-foreground">
                          {t.count} คน
                        </text>
                      </>
                    )}
                    <rect x={L} y={narrow ? y + 20 : y + 6} width={Math.max(0, x(t.avg) - L)} height="24" rx="2" fill={t.avg >= company ? "#1976d2" : SOFT} />
                    <text x={x(t.avg) + 6} y={narrow ? y + 37 : y + 23} fontSize="14" fontWeight="700" className="fill-foreground">
                      {fmt(t.avg)}%
                    </text>
                  </g>
                );
              })}
              <line x1={x(company)} x2={x(company)} y1={Tp - 8} y2={H - 22} className="stroke-foreground" strokeWidth="1.5" strokeDasharray="5 4" />
              <text x={Math.min(x(company), W - 60)} y={Tp - 12} textAnchor="middle" fontSize="12" className="fill-foreground">
                บริษัท {fmt(company)}%
              </text>
            </svg>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
                <i className="inline-block size-3 rounded-[2px]" style={{ background: "#1976d2" }} aria-hidden="true" />
                เท่ากับหรือสูงกว่าบริษัท
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-0.5">
                <i className="inline-block size-3 rounded-[2px]" style={{ background: SOFT }} aria-hidden="true" />
                ต่ำกว่าบริษัท
              </span>
            </div>
          </>
        );
      }}
    </Measured>
  );
}

export interface TrendSeries {
  name: string;
  values: (number | null)[];
  color: string;
  width: number;
  dash?: string;
}

/** Lines over the rounds. The value (and on a wide chart the name) sits at the end of each line, nudged apart so they do not overlap. */
export function TrendLines({ labels, series }: { labels: string[]; series: TrendSeries[] }) {
  return (
    <Measured label="กราฟเส้นแนวโน้มคะแนนเฉลี่ยรายรอบ">
      {(W) => {
        const narrow = W < NARROW;
        const H = narrow ? 260 : 300;
        const L = 34;
        const R = narrow ? 56 : Math.min(230, Math.round(W * 0.3));
        const Tp = 14;
        const Bm = 30;
        const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
        const lo = Math.max(0, Math.floor((Math.min(...all, 100) - 5) / 10) * 10);
        const hi = 100;
        const x = (i: number) => L + 8 + (W - L - R - 16) * (labels.length <= 1 ? 0 : i / (labels.length - 1));
        const y = (v: number) => Tp + (H - Tp - Bm) * (1 - (v - lo) / (hi - lo));
        const grid: number[] = [];
        for (let g = lo; g <= hi; g += 10) grid.push(g);
        const ends = series
          .map((s) => {
            const last = s.values[s.values.length - 1];
            return last === null || last === undefined ? null : { y: y(last), name: s.name, v: last, color: s.color };
          })
          .filter((e): e is { y: number; name: string; v: number; color: string } => e !== null)
          .sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 15) ends[i]!.y = ends[i - 1]!.y + 15;
        return (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
            {grid.map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke={AXIS} />
                <text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">
                  {g}
                </text>
              </g>
            ))}
            {labels.map((m, i) => (
              <text key={`${m}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" className="fill-muted-foreground">
                {m}
              </text>
            ))}
            {series.map((s) => {
              const pts = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const)));
              let d = "";
              for (const p of pts) if (p) d += `${d ? "L" : "M"}${p[0]} ${p[1]}`;
              return (
                <g key={s.name}>
                  <path d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinejoin="round" />
                  {pts.map((p, i) => (p ? <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#fff" stroke={s.color} strokeWidth="2" /> : null))}
                </g>
              );
            })}
            {ends.map((e) => (
              <g key={e.name}>
                <text x={W - R + 10} y={e.y + 4} fontSize="13" fontWeight="700" fill={e.color}>
                  {fmt(e.v)}%
                </text>
                {!narrow && (
                  <text x={W - R + 56} y={e.y + 4} fontSize="12" className="fill-muted-foreground">
                    {cut(e.name, 16)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        );
      }}
    </Measured>
  );
}

/** People whose score rose (right, blue) and fell (left, red) against their previous round, in points, with an arrow and the word. */
export function MoveBars({ rows }: { rows: { name: string; team: string; delta: number }[] }) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">ยังไม่มีคนที่ถูกประเมินมากกว่าหนึ่งรอบ จึงยังเทียบไม่ได้</p>;
  return (
    <Measured label="กราฟคนที่คะแนนขึ้นและลงมากที่สุดเทียบรอบก่อน">
      {(W) => {
        const narrow = W < NARROW;
        // Wide: names on the left, bars grow from a line at 58%. Narrow: each name sits above its own bar, bars grow from the middle.
        const rowH = narrow ? 68 : 36;
        const mid = narrow ? W / 2 : W * 0.58;
        const half = narrow ? W / 2 - 74 : W * 0.3;
        const Tp = 8;
        const H = Tp + rows.length * rowH + 6;
        const m = Math.max(...rows.map((r) => Math.abs(r.delta)), 5);
        return (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full">
            {rows.map((r, i) => {
              const y = Tp + i * rowH;
              const w = (half * Math.abs(r.delta)) / m;
              const up = r.delta > 0;
              const by = narrow ? y + 38 : y + 6;
              return (
                <g key={`${r.name}-${i}`}>
                  <title>{`${r.name} ${r.team}`}</title>
                  <text x="4" y={y + 15} fontSize="13" className="fill-foreground">
                    {cut(r.name, narrow ? 34 : 18)}
                  </text>
                  <text x="4" y={y + 30} fontSize="12" className="fill-muted-foreground">
                    {cut(r.team, narrow ? 40 : 20)}
                  </text>
                  <rect x={up ? mid : mid - w} y={by} width={w} height="20" rx="2" className={up ? "fill-primary" : "fill-destructive"} />
                  <text x={up ? mid + w + 6 : mid - w - 6} y={by + 15} textAnchor={up ? "start" : "end"} fontSize="13" fontWeight="700" className={up ? "fill-status-normal-fg" : "fill-destructive"}>
                    {up ? "▲ ขึ้น" : "▼ ลง"} {fmt(Math.abs(r.delta))}
                  </text>
                </g>
              );
            })}
            <line x1={mid} x2={mid} y1="0" y2={H} stroke="#98a2b3" />
          </svg>
        );
      }}
    </Measured>
  );
}
