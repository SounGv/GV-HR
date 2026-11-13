"use client";

import { useState } from "react";
import { monotonePath, trendStats, type TrendInput } from "./chart-math";

const W = 680;
const H = 270;
const L = 44;
const R = 40;
const T = 34;
const B = 34;
const IW = W - L - R;
const IH = H - T - B;
const RATE_MIN = 80;
const FONT = "var(--font-sans, inherit)";

/** Right-axis top: the next multiple of 5 above the busiest late day (at least 10). */
function lateCeiling(max: number): number {
  return Math.max(10, Math.ceil(max / 5) * 5);
}

/**
 * "การเข้างาน 14 วันทำการ" (approved mock charts-placement-mock.html): % of people
 * at work as a smooth teal line over the late count as bars. Ordinary days stay
 * quiet; only days clearly off the period average get a status colour and a
 * number, the worst day gets a callout, today gets a large dot.
 */
export function AttendanceTrendChart({ data }: { data: TrendInput[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการเข้างานย้อนหลัง</p>;
  }
  const { days, avgRate, worst } = trendStats(data);
  const n = days.length;
  const step = IW / n;
  const lateTop = lateCeiling(Math.max(...days.map((d) => d.late)));
  const rateMin = Math.min(RATE_MIN, Math.floor(Math.min(...days.map((d) => d.rate)) / 5) * 5);
  const x = (i: number) => L + step * i + step / 2;
  const yRate = (v: number) => T + IH - ((v - rateMin) / (100 - rateMin)) * IH;
  const yLate = (v: number) => T + IH - (v / lateTop) * IH;
  const rateTicks: number[] = [];
  for (let v = rateMin; v <= 100; v += rateMin <= 60 ? 10 : 5) rateTicks.push(v);
  const line = monotonePath(days.map((d, i) => [x(i), yRate(d.rate)]));
  const barW = Math.min(16, step * 0.4);
  const last = days[n - 1];
  const w = worst >= 0 ? days[worst] : null;
  const calloutW = 150;
  const calloutX = w ? Math.min(Math.max(x(worst) - calloutW / 2, L), W - R - calloutW) : 0;
  const calloutY = w ? Math.min(yRate(w.rate) + 16, T + IH - 26) : 0;
  const hd = hover != null ? days[hover] : null;

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[520px]"
        role="img"
        aria-label={`อัตราการเข้างานและจำนวนคนสาย ${n} วันทำการล่าสุด เฉลี่ย ${Math.round(avgRate)}%`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gv-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--series-highlight)", stopOpacity: 0.28 }} />
            <stop offset="1" style={{ stopColor: "var(--series-highlight)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        <g fontSize={11} style={{ fill: "var(--muted-foreground)", fontFamily: FONT }}>
          {rateTicks.map((v) => (
            <g key={v}>
              <line
                x1={L}
                x2={W - R}
                y1={yRate(v)}
                y2={yRate(v)}
                style={{ stroke: "var(--chart-grid)" }}
                strokeDasharray={v === rateMin ? undefined : "2 4"}
              />
              <text x={L - 8} y={yRate(v) + 4} textAnchor="end">
                {v}%
              </text>
            </g>
          ))}
          {[0, lateTop / 2, lateTop].map((v) => (
            <text key={v} x={W - R + 8} y={yLate(v) + 4}>
              {v}
            </text>
          ))}
          {days.map((d, i) =>
            i % 2 === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 10} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>

        {/* Late bars: grey on ordinary days, solid amber with the count when clearly above usual. */}
        {days.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - barW / 2}
              y={yLate(d.late)}
              width={barW}
              height={T + IH - yLate(d.late)}
              rx={4}
              style={{ fill: d.lateHigh ? "var(--status-late-dot)" : "var(--chart-muted-bar)" }}
            />
            {d.lateHigh && (
              <text
                x={x(i)}
                y={yLate(d.late) - 5}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                style={{ fill: "var(--status-late-fg)", fontFamily: FONT }}
              >
                {d.late}
              </text>
            )}
          </g>
        ))}

        {/* The period's own average as a quiet reference. */}
        <line
          x1={L}
          x2={W - R}
          y1={yRate(avgRate)}
          y2={yRate(avgRate)}
          style={{ stroke: "var(--muted-foreground)" }}
          strokeDasharray="6 5"
          opacity={0.6}
        />
        <text x={L + 6} y={yRate(avgRate) - 6} fontSize={11} style={{ fill: "var(--muted-foreground)", fontFamily: FONT }}>
          เฉลี่ย {n} วัน {Math.round(avgRate)}%
        </text>

        <path d={`${line} L${x(n - 1)},${T + IH} L${x(0)},${T + IH} Z`} style={{ fill: "url(#gv-trend-area)" }} />
        <path d={line} fill="none" style={{ stroke: "var(--series-highlight)" }} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {days.map((d, i) => {
          if (d.low) {
            return (
              <g key={i}>
                <circle cx={x(i)} cy={yRate(d.rate)} r={5} style={{ fill: "var(--status-absent-dot)", stroke: "var(--card)" }} strokeWidth={2} />
                {i !== worst && (
                  <text
                    x={x(i)}
                    y={yRate(d.rate) + 20}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={600}
                    style={{ fill: "var(--status-absent-fg)", fontFamily: FONT }}
                  >
                    {Math.round(d.rate)}%
                  </text>
                )}
              </g>
            );
          }
          if (i === n - 1) {
            return (
              <g key={i}>
                <circle cx={x(i)} cy={yRate(d.rate)} r={10} style={{ fill: "var(--series-highlight)" }} opacity={0.18} />
                <circle cx={x(i)} cy={yRate(d.rate)} r={5} style={{ fill: "var(--series-highlight)", stroke: "var(--card)" }} strokeWidth={2} />
              </g>
            );
          }
          return null;
        })}

        {w && (
          <g>
            <line x1={x(worst)} x2={x(worst)} y1={yRate(w.rate) + 6} y2={calloutY} style={{ stroke: "var(--status-absent-dot)" }} />
            <rect
              x={calloutX}
              y={calloutY}
              width={calloutW}
              height={24}
              rx={7}
              style={{ fill: "var(--status-absent-bg)", stroke: "var(--status-absent-dot)" }}
            />
            <text
              x={calloutX + calloutW / 2}
              y={calloutY + 16}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              style={{ fill: "var(--status-absent-fg)", fontFamily: FONT }}
            >
              ▼ ต่ำสุด {Math.round(w.rate)}% · สาย {w.late} คน
            </text>
          </g>
        )}

        <text
          x={x(n - 1) - 10}
          y={yRate(last.rate) - 14}
          textAnchor="end"
          fontSize={13}
          fontWeight={700}
          style={{ fill: "var(--foreground)", fontFamily: FONT }}
        >
          ล่าสุด {Math.round(last.rate)}%
        </text>

        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + IH} style={{ stroke: "var(--muted-foreground)" }} opacity={0.5} />
        )}
        {days.map((_, i) => (
          <rect key={i} x={x(i) - step / 2} y={T} width={step} height={IH} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>

      {hd && hover != null && (
        <div
          className="pointer-events-none absolute z-10 rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] leading-relaxed whitespace-nowrap shadow-md"
          style={{
            top: `${(yRate(hd.rate) / H) * 100}%`,
            ...(hover > n / 2 ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }),
          }}
        >
          <b>{hd.label}</b>
          <br />
          มาทำงาน <b className="tabular-nums">{Math.round(hd.rate)}%</b>
          {hd.low && <span className="text-status-absent-fg"> ต่ำกว่าปกติ</span>}
          <br />
          สาย <b className="tabular-nums">{hd.late}</b> คน
          {hd.lateHigh && <span className="text-status-late-fg"> มากกว่าปกติ</span>}
        </div>
      )}
    </div>
  );
}
