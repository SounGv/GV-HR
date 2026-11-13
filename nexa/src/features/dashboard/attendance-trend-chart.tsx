"use client";

import { useEffect, useRef, useState } from "react";
import { monotonePath, niceCeiling, trendStats, type TrendInput } from "./chart-math";

const H = 260;
const L = 40;
const R = 34;
const T = 30;
const B = 30;
const FONT = "inherit";

/**
 * "การเข้างาน 14 วันทำการ" (approved mock charts-placement-mock.html): people who
 * clocked in as a smooth teal line over the late count as bars. Ordinary days
 * stay quiet; only days clearly off the period average get a status colour and
 * a number, and the lowest day gets a callout.
 *
 * Drawn at the container's real pixel width (not a scaled viewBox), so text
 * stays 11–13px on any screen instead of growing with the card.
 */
export function AttendanceTrendChart({ data }: { data: TrendInput[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(360, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการเข้างานย้อนหลัง</p>;
  }
  const { days, avgPresent, worst } = trendStats(data);
  const n = days.length;
  const IW = W - L - R;
  const IH = H - T - B;
  const step = IW / n;
  const presentTop = niceCeiling(Math.max(...days.map((d) => d.present)));
  const lateTop = Math.max(5, niceCeiling(Math.max(...days.map((d) => d.late))));
  const x = (i: number) => L + step * i + step / 2;
  const yP = (v: number) => T + IH - (v / presentTop) * IH;
  const yL = (v: number) => T + IH - (v / lateTop) * IH;
  // Five even steps: every axis top from niceCeiling divides by 5 into whole numbers.
  const ticks = [0, 1, 2, 3, 4, 5].map((k) => (presentTop * k) / 5);
  const line = monotonePath(days.map((d, i) => [x(i), yP(d.present)]));
  const barW = Math.min(14, step * 0.38);
  const labelEvery = step < 46 ? 3 : step < 70 ? 2 : 1;
  const last = days[n - 1];
  const w = worst >= 0 ? days[worst] : null;
  const calloutW = 168;
  const calloutX = w ? Math.min(Math.max(x(worst) - calloutW / 2, L), W - R - calloutW) : 0;
  const calloutY = w ? Math.min(yP(w.present) + 14, T + IH - 26) : 0;
  const hd = hover != null ? days[hover] : null;

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        width={W}
        height={H}
        className="block"
        role="img"
        aria-label={`คนลงเวลาเข้างานและคนสาย ${n} วันทำการล่าสุด เฉลี่ยวันละ ${Math.round(avgPresent)} คน`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gv-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--series-highlight)", stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: "var(--series-highlight)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        <g fontSize={11} style={{ fill: "var(--muted-foreground)", fontFamily: FONT }}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yP(v)} y2={yP(v)} style={{ stroke: "var(--chart-grid)" }} strokeDasharray={v === 0 ? undefined : "2 4"} />
              <text x={L - 8} y={yP(v) + 4} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {[0, lateTop].map((v) => (
            <text key={v} x={W - R + 8} y={yL(v) + 4}>
              {v}
            </text>
          ))}
          <text x={L - 8} y={T - 14} textAnchor="end">
            คน
          </text>
          <text x={W - R + 8} y={T - 14}>
            สาย
          </text>
          {days.map((d, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>

        {days.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - barW / 2}
              y={yL(d.late)}
              width={barW}
              height={Math.max(0, T + IH - yL(d.late))}
              rx={3}
              style={{ fill: d.lateHigh ? "var(--status-late-dot)" : "var(--chart-muted-bar)" }}
            />
            {d.lateHigh && (
              <text x={x(i)} y={yL(d.late) - 5} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: "var(--status-late-fg)", fontFamily: FONT }}>
                {d.late}
              </text>
            )}
          </g>
        ))}

        <line x1={L} x2={W - R} y1={yP(avgPresent)} y2={yP(avgPresent)} style={{ stroke: "var(--muted-foreground)" }} strokeDasharray="6 5" opacity={0.55} />
        <text x={W - R - 6} y={yP(avgPresent) - 6} textAnchor="end" fontSize={11} style={{ fill: "var(--muted-foreground)", fontFamily: FONT }}>
          เฉลี่ยวันละ {Math.round(avgPresent)} คน
        </text>

        <path d={`${line} L${x(n - 1)},${T + IH} L${x(0)},${T + IH} Z`} style={{ fill: "url(#gv-trend-area)" }} />
        <path d={line} fill="none" style={{ stroke: "var(--series-highlight)" }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {days.map((d, i) =>
          d.low ? (
            <g key={i}>
              <circle cx={x(i)} cy={yP(d.present)} r={4.5} style={{ fill: "var(--status-absent-dot)", stroke: "var(--card)" }} strokeWidth={2} />
              {i !== worst && (
                <text x={x(i)} y={yP(d.present) + 18} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: "var(--status-absent-fg)", fontFamily: FONT }}>
                  {d.present}
                </text>
              )}
            </g>
          ) : null,
        )}
        {!last.low && (
          <g>
            <circle cx={x(n - 1)} cy={yP(last.present)} r={9} style={{ fill: "var(--series-highlight)" }} opacity={0.18} />
            <circle cx={x(n - 1)} cy={yP(last.present)} r={4.5} style={{ fill: "var(--series-highlight)", stroke: "var(--card)" }} strokeWidth={2} />
          </g>
        )}
        <text x={x(n - 1) - 12} y={yP(last.present) - 12} textAnchor="end" fontSize={12} fontWeight={700} style={{ fill: "var(--foreground)", fontFamily: FONT }}>
          {last.label} {last.present} คน
        </text>

        {w && (
          <g>
            <line x1={x(worst)} x2={x(worst)} y1={yP(w.present) + 5} y2={calloutY} style={{ stroke: "var(--status-absent-dot)" }} />
            <rect x={calloutX} y={calloutY} width={calloutW} height={22} rx={6} style={{ fill: "var(--status-absent-bg)", stroke: "var(--status-absent-dot)" }} />
            <text x={calloutX + calloutW / 2} y={calloutY + 15} textAnchor="middle" fontSize={11.5} fontWeight={600} style={{ fill: "var(--status-absent-fg)", fontFamily: FONT }}>
              ▼ น้อยสุด {w.present} คน · สาย {w.late} คน
            </text>
          </g>
        )}

        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + IH} style={{ stroke: "var(--muted-foreground)" }} opacity={0.45} />}
        {days.map((_, i) => (
          <rect key={i} x={x(i) - step / 2} y={T} width={step} height={IH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>

      {hd && hover != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] leading-relaxed whitespace-nowrap shadow-md"
          style={{ top: Math.max(0, yP(hd.present) - 30), ...(hover > n / 2 ? { right: W - x(hover) + 12 } : { left: x(hover) + 12 }) }}
        >
          <b>{hd.label}</b>
          <br />
          ลงเวลาเข้างาน <b className="tabular-nums">{hd.present}</b> คน
          {hd.low && <span className="text-status-absent-fg"> น้อยกว่าปกติ</span>}
          <br />
          สาย <b className="tabular-nums">{hd.late}</b> คน
          {hd.lateHigh && <span className="text-status-late-fg"> มากกว่าปกติ</span>}
        </div>
      )}
    </div>
  );
}
