"use client";

import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { bandOf, type BandTone } from "./exec-summary-rules";

/**
 * Small SVG charts of the executive summary (appraisal-boss-overview-mock.html): vertical columns, a smooth line, paired
 * columns for comparing two rounds, and a sparkline. They draw at a fixed width and sit in a box that scrolls sideways on a
 * phone, so text stays at 12px or more. Every column, point or group that opens something is a real button for the keyboard.
 */

const TONE_FILL: Record<BandTone, string> = { good: "var(--status-normal-dot)", ok: "var(--status-late-dot)", watch: "var(--status-absent-dot)" };
export const toneFill = (percent: number): string => TONE_FILL[bandOf(percent)];

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const TEXT = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const GRID = "var(--chart-grid)";
const BLUE = "var(--chart-1)";

/** A chart is never drawn wider than this many times its own width: on a wide screen it stays readable instead of blowing up the axis text. */
const MAX_GROW = 1.25;

const hit = "cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]";
function press(fn?: () => void) {
  return fn
    ? { role: "button" as const, tabIndex: 0, onClick: fn, onKeyDown: (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fn()) }
    : {};
}

/** Wraps a chart so it never gets narrower than `min` pixels; the page scrolls sideways inside it instead. */
export function ChartBox({ min = 520, children }: { min?: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: min }}>{children}</div>
    </div>
  );
}

function scaleOf(n: number, W: number, H: number, L: number, R: number, T: number, B: number, lo: number, hi: number) {
  return {
    x: (i: number) => (n === 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (n - 1)),
    y: (v: number) => T + (H - T - B) * (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)),
  };
}

function ticks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += 10) out.push(t);
  return out;
}

const floorOf = (vals: (number | null)[], fallback = 60) => {
  const real = vals.filter((v): v is number => v !== null);
  return real.length && Math.min(...real) < fallback ? Math.max(0, Math.floor((Math.min(...real) - 5) / 10) * 10) : fallback;
};

/** One vertical column per value, coloured by score band, with the value on top and the change from the column before under the label. */
export function ColumnChart({
  values,
  labels,
  onPick,
  label,
  height = 280,
  deltas,
  refValue,
}: {
  values: (number | null)[];
  labels: string[];
  onPick?: (i: number) => void;
  label: string;
  height?: number;
  /** The change shown under each column; by default the change from the column before. */
  deltas?: (number | null)[];
  /** A dashed line across the columns (for example the company average). */
  refValue?: number | null;
}) {
  const W = 640;
  const H = height;
  const L = 40;
  const R = 20;
  const T = 30;
  const B = 44;
  const n = values.length;
  const lo = floorOf(values);
  const { y } = scaleOf(Math.max(n, 2), W, H, L, R, T, B, lo, 100);
  const slot = (W - L - R) / Math.max(n, 1);
  const bw = Math.min(54, slot * 0.6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * MAX_GROW }} role="img" aria-label={label}>
      {ticks(lo, 100).map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill={MUTED}>
            {t}
          </text>
        </g>
      ))}
      {refValue !== null && refValue !== undefined && (
        <g>
          <line x1={L} x2={W - R} y1={y(refValue)} y2={y(refValue)} stroke={TEXT} strokeDasharray="6 4" />
          <text x={L + 6} y={y(refValue) - 6} fontSize={12} fontWeight={600} fill={TEXT} stroke="var(--card)" strokeWidth={4} paintOrder="stroke">
            เฉลี่ยบริษัท {num(refValue)}
          </text>
        </g>
      )}
      {values.map((v, i) => {
        const cx = L + slot * i + slot / 2;
        const prev = i > 0 ? values[i - 1] : null;
        const d = deltas ? (deltas[i] ?? null) : v !== null && prev !== null ? Math.round((v - prev) * 10) / 10 : null;
        return (
          <g key={i} {...press(onPick && v !== null ? () => onPick(i) : undefined)} className={onPick && v !== null ? hit : undefined} aria-label={v !== null ? `${labels[i]} เฉลี่ย ${num(v)}` : undefined}>
            {v !== null && (
              <>
                <rect x={cx - bw / 2} y={y(v)} width={bw} height={H - B - y(v)} rx={6} fill={toneFill(v)} opacity={i === n - 1 ? 1 : 0.8} />
                <text x={cx} y={y(v) - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill={TEXT}>
                  {num(v)}
                </text>
              </>
            )}
            <text x={cx} y={H - 24} textAnchor="middle" fontSize={13} fill={MUTED}>
              {labels[i]}
            </text>
            {d !== null && d !== 0 && (
              <text x={cx} y={H - 7} textAnchor="middle" fontSize={12} fontWeight={600} fill={d < 0 ? "var(--destructive)" : "var(--success)"}>
                {d < 0 ? "▼" : "▲"} {num(Math.abs(d))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function curve(pts: [number, number][]): string {
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)},${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)},${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A smooth line over the months with month guide lines, the 90 and 80 marks and a callout on the latest point. Missing months are skipped. */
export function SmoothLine({ values, labels, onPick, label }: { values: (number | null)[]; labels: string[]; onPick?: (i: number) => void; label: string }) {
  const W = 640;
  const H = 280;
  const L = 40;
  const T = 44;
  const B = 40;
  const n = values.length;
  const real = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const lo = Math.min(70, floorOf(values, 70));
  const hi = 95;
  const { x, y } = scaleOf(n, W, H, L + 26, 46, T, B, lo, hi);
  if (real.length === 0) return null;
  const pts = real.map((p): [number, number] => [x(p.i), y(p.v)]);
  const lastP = real[real.length - 1]!;
  const prevP = real[real.length - 2];
  const delta = prevP ? Math.round((lastP.v - prevP.v) * 10) / 10 : null;
  const bubbleText = `${labels[lastP.i]} ${num(lastP.v)}${delta === null || delta === 0 ? "" : delta < 0 ? ` ▼${num(-delta)}` : ` ▲${num(delta)}`}`;
  const gid = `area-${labels.join("").length}-${n}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * MAX_GROW }} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={BLUE} stopOpacity=".22" />
          <stop offset="1" stopColor={BLUE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.map((_, i) => (
        <line key={i} x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke={GRID} />
      ))}
      {[90, 80].filter((t) => t >= lo && t <= hi).map((t) => (
        <g key={t}>
          <line x1={L} x2={W - 46} y1={y(t)} y2={y(t)} stroke={t === 90 ? "var(--success)" : "var(--destructive)"} strokeOpacity=".45" strokeDasharray="6 5" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill={t === 90 ? "var(--success)" : "var(--destructive)"}>
            {t}
          </text>
        </g>
      ))}
      <path d={`${curve(pts)} L${pts[pts.length - 1]![0]},${H - B} L${pts[0]![0]},${H - B} Z`} fill={`url(#${gid})`} />
      <path d={curve(pts)} fill="none" stroke={BLUE} strokeWidth={4} strokeLinecap="round" />
      {values.map((v, i) => {
        const cx = x(i);
        const isLast = i === lastP.i;
        return (
          <g key={i} {...press(onPick && v !== null ? () => onPick(i) : undefined)} className={onPick && v !== null ? hit : undefined} aria-label={v !== null ? `${labels[i]} เฉลี่ย ${num(v)}` : undefined}>
            {v !== null && <circle cx={cx} cy={y(v)} r={22} fill="transparent" />}
            {v !== null && isLast && <circle cx={cx} cy={y(v)} r={12} fill={BLUE} opacity=".2" />}
            {v !== null && <circle cx={cx} cy={y(v)} r={isLast ? 7 : 5} fill="var(--card)" stroke={BLUE} strokeWidth={isLast ? 4 : 3} />}
            {v !== null && !isLast && (
              <text x={cx} y={y(v) + 22} textAnchor="middle" fontSize={12} fill={MUTED}>
                {num(v)}
              </text>
            )}
            <text x={cx} y={H - 14} textAnchor="middle" fontSize={13} fill={MUTED}>
              {labels[i]}
            </text>
          </g>
        );
      })}
      <g>
        <rect x={x(lastP.i) - 112} y={y(lastP.v) - 42} width={126} height={28} rx={14} fill="var(--primary)" />
        <text x={x(lastP.i) - 49} y={y(lastP.v) - 23} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--primary-foreground)">
          {bubbleText}
        </text>
      </g>
    </svg>
  );
}

export interface PairRow {
  name: string;
  a: number | null;
  b: number | null;
  onPick?: () => void;
}

/** Two columns per group (earlier in grey, later coloured by band) with the change under the name; the axis starts at 50 so differences show. */
export function PairedColumns({ rows, label, legend }: { rows: PairRow[]; label: string; legend?: [earlier: string, later: string] }) {
  const W = Math.max(560, 80 * rows.length + 60);
  const H = 300;
  const L = 36;
  const R = 10;
  const T = 26;
  const B = 58;
  const lo = 50;
  const slot = (W - L - R) / Math.max(rows.length, 1);
  const bw = Math.min(30, slot * 0.34);
  const { y } = scaleOf(2, W, H, L, R, T, B, lo, 100);
  return (
    <div>
      {legend && (
        <p className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--chart-muted-bar)" }} aria-hidden="true" />
            แท่งเทา = {legend[0]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "var(--status-normal-dot)" }} aria-hidden="true" />
            แท่งสี = {legend[1]}
          </span>
        </p>
      )}
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * MAX_GROW }} role="img" aria-label={label}>
      {ticks(lo, 100).map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={12} fill={MUTED}>
            {t}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const cx = L + slot * i + slot / 2;
        const d = r.a !== null && r.b !== null ? Math.round((r.b - r.a) * 10) / 10 : null;
        return (
          <g key={`${r.name}-${i}`} {...press(r.onPick)} className={r.onPick ? hit : undefined} aria-label={`ดู ${r.name}`}>
            <rect x={cx - slot / 2 + 2} y={T} width={slot - 4} height={H - B - T} fill={i % 2 ? "var(--muted)" : "transparent"} opacity={0.5} />
            {r.a !== null && <rect x={cx - bw - 1} y={y(r.a)} width={bw} height={H - B - y(r.a)} rx={4} fill="var(--chart-muted-bar)" />}
            {r.b !== null && <rect x={cx + 1} y={y(r.b)} width={bw} height={H - B - y(r.b)} rx={4} fill={toneFill(r.b)} />}
            {r.a !== null && (
              <text x={cx - bw / 2 - 1} y={y(r.a) - 5} textAnchor="middle" fontSize={12} fill={MUTED}>
                {num(r.a)}
              </text>
            )}
            {r.b !== null && (
              <text x={cx + bw / 2 + 1} y={y(r.b) - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
                {num(r.b)}
              </text>
            )}
            <text x={cx} y={H - 38} textAnchor="middle" fontSize={12} fill={TEXT}>
              {r.name.length > 11 ? `${r.name.slice(0, 10)}…` : r.name}
            </text>
            {d !== null && (
              <text x={cx} y={H - 20} textAnchor="middle" fontSize={12} fontWeight={600} fill={d < 0 ? "var(--destructive)" : d > 0 ? "var(--success)" : MUTED}>
                {d < 0 ? "▼" : d > 0 ? "▲" : "–"} {num(Math.abs(d))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** A tiny line of one team over the rounds with the 90 and 80 marks; the last dot takes the colour of its band. */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const W = 220;
  const H = 86;
  const real = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (real.length === 0) return null;
  const { x, y } = scaleOf(values.length, W, H, 16, 16, 18, 8, 65, 100);
  const line = real.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = real[real.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
      <line x1={0} x2={W} y1={y(90)} y2={y(90)} stroke="var(--success)" strokeOpacity=".4" strokeDasharray="4 3" />
      <line x1={0} x2={W} y1={y(80)} y2={y(80)} stroke="var(--destructive)" strokeOpacity=".4" strokeDasharray="4 3" />
      <path d={line} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {real.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={p === last ? 5 : 2.5} fill={p === last ? toneFill(p.v) : BLUE} />
      ))}
      {real.map((p) => (
        <text key={`t${p.i}`} x={x(p.i)} y={y(p.v) - (p === last ? 9 : 6)} textAnchor="middle" fontSize={p === last ? 9 : 8} fontWeight={p === last ? 700 : 400} fill={TEXT}>
          {Math.round(p.v * 10) / 10}
        </text>
      ))}
    </svg>
  );
}

/** The seg-style toggle of the mock (a pill with two or three choices). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-muted p-0.5 print:hidden">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-full px-4 text-sm md:min-h-9", o.value === value ? "bg-card font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
