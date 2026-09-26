"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DeptDatum } from "./group-departments";
import type { AttendanceTrendPoint } from "./service";
import { cn } from "@/lib/utils";

// Validated categorical palette (dataviz skill's reference set, reordered
// brand-green-first and re-validated — see scripts/validate_palette.js in
// the skill: both orders clear every adjacent-pair CVD/contrast gate).
// Capped at 8 slots on purpose — a 9th series is never a generated hue, it
// folds into "Other" (see group-departments.ts's groupTopDepartments cap).
const CATEGORY_COLORS_LIGHT = [
  "#008300", // green (brand primary)
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#4a3aa7", // violet
  "#e34948", // red
];
const CATEGORY_COLORS_DARK = [
  "#008300", // green — mode-invariant per the reference palette
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#9085e9", // violet
  "#e66767", // red
];
const OTHER_COLOR = "var(--muted-foreground)";

/** Resolved-theme-aware categorical color list — SSR-safe (defaults to the
 * light set until mounted, matching ThemeToggle's own hydration guard). */
function useCategoryColors(): string[] {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === "dark" ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;
}

function colorFor(colors: string[], index: number, isOther: boolean): string {
  return isOther ? OTHER_COLOR : colors[index % colors.length];
}

export function DepartmentDonut({ data }: { data: DeptDatum[] }) {
  const colors = useCategoryColors();
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <EmptyChart />;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [`${value} คน`, name]}
          isAnimationActive={false}
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius={62}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(colors, i, d.name === "อื่นๆ")} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HeadcountBar({ data, singleColor }: { data: DeptDatum[]; singleColor?: string }) {
  const colors = useCategoryColors();
  if (data.length === 0) return <EmptyChart />;
  // Horizontal bars — a vertical bar chart with 15-20 long department names
  // crammed along the X axis collides into an unreadable block. Laid out
  // top-to-bottom like a ranked list instead, height grows with the count
  // so nothing gets cramped no matter how many departments there are.
  const height = Math.max(280, data.length * 32);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={180}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} คน`, "จำนวน"]}
          isAnimationActive={false}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={singleColor ?? colorFor(colors, i, false)}
              opacity={singleColor || i < colors.length ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};

function EmptyChart() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      ยังไม่มีข้อมูลเพียงพอ
    </div>
  );
}

const TREND_SERIES: { key: keyof AttendanceTrendPoint; label: string; color: string }[] = [
  { key: "present", label: "มาทำงาน", color: "#0e9f8e" },
  { key: "late", label: "มาสาย", color: "#f59e0b" },
  { key: "absent", label: "ขาดงาน", color: "#e4573d" },
  { key: "leave", label: "ลา", color: "#8b5cf6" },
  { key: "otHours", label: "OT (ชม.)", color: "#3b82f6" },
];

/** Companywide attendance/leave/OT trend over the last N business days —
 * "จุดสังเกต" for HR: a late/absent spike or a leave cluster reads at a
 * glance instead of needing to compare daily reports by hand. Each series
 * carries a soft gradient wash under its line (dataviz skill: area fill =
 * series hue as a wash, fading to nothing — never a saturated block), same
 * per-metric colors as everywhere else this data appears on the dashboard. */
export function AttendanceTrendChart({ data }: { data: AttendanceTrendPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <defs>
          {TREND_SERIES.map((s) => (
            <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={0}
          minTickGap={4}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600, marginBottom: 4 }} isAnimationActive={false} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {TREND_SERIES.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#trend-fill-${s.key})`}
            dot={{ r: 2.5, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 4, fill: s.color, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** One line series in AttendanceRateLine, in draw order (Area/bottom-most
 * first). "ไม่มีบันทึก" (`noRecordPct`) reuses the existing `absent` field —
 * this app has no separate confirmed-ABSENT status surfaced yet (see the
 * dashboard-fix-3 doc), so a missing clock-in reads as incomplete data
 * (grey, dashed, no dot) rather than a red confirmed absence. */
const RATE_SERIES = [
  { key: "presentPct", label: "เข้างาน", color: "var(--series-present)", width: 3.5, dash: undefined, dot: true },
  { key: "latePct", label: "มาสาย", color: "var(--series-late)", width: 2.5, dash: undefined, dot: true },
  { key: "leavePct", label: "ลา", color: "var(--series-leave)", width: 2.5, dash: undefined, dot: true },
  { key: "noRecordPct", label: "ไม่มีบันทึก", color: "var(--series-norecord)", width: 2, dash: "6 7", dot: false },
] as const;

interface RatePoint {
  label: string;
  presentPct: number;
  latePct: number;
  leavePct: number;
  noRecordPct: number;
}

/** Hollow dot (line color ring, card-colored fill) for every point except the
 * latest business day, which gets a bigger filled dot — draws the eye to
 * "where we are today" without a separate marker layer. */
function rateDot(color: string, lastIndex: number) {
  function RateDot(props: { cx?: number; cy?: number; index?: number }) {
    const { cx, cy, index } = props;
    if (cx == null || cy == null || index == null) return <React.Fragment />;
    const isLast = index === lastIndex;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={isLast ? 5.5 : 3}
        fill={isLast ? color : "var(--card)"}
        stroke={color}
        strokeWidth={2}
      />
    );
  }
  return RateDot;
}

/**
 * Attendance-rate line chart (dashboard-fix-3): each business day's headcount
 * as percentages of active headcount, so the shape reads the same regardless
 * of company size, with a legend that toggles series on/off. Percentages are
 * derived here from the existing raw counts (`present`/`late`/`leave`/
 * `absent`) — no service-layer change, no new field.
 */
export function AttendanceRateLine({ data }: { data: AttendanceTrendPoint[] }) {
  const [hidden, setHidden] = React.useState<Record<string, boolean>>({});
  if (data.length === 0) return <EmptyChart />;

  const points: RatePoint[] = data.map((d) => {
    const total = d.present + d.leave + d.absent || 1;
    return {
      label: d.label,
      presentPct: (d.present / total) * 100,
      latePct: (d.late / total) * 100,
      leavePct: (d.leave / total) * 100,
      noRecordPct: (d.absent / total) * 100,
    };
  });
  const lastIndex = points.length - 1;
  const lastLabel = points[lastIndex].label;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {RATE_SERIES.map((s) => {
          const off = hidden[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition",
                off ? "text-muted-foreground/50" : "text-muted-foreground hover:bg-muted",
              )}
              aria-pressed={!off}
            >
              <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true">
                <line
                  x1="0" y1="4" x2="14" y2="4"
                  stroke={off ? "var(--chart-muted-bar)" : s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
                />
                {s.dot && !off && <circle cx="7" cy="4" r="2" fill={s.color} />}
              </svg>
              {s.label}
            </button>
          );
        })}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 20, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <ReferenceArea x1={lastLabel} x2={lastLabel} fill="var(--series-highlight)" fillOpacity={0.07} />
          <XAxis
            dataKey="label"
            tick={(props) => {
              const { x, y, payload } = props;
              const isLast = payload.value === lastLabel;
              return (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={isLast ? 700 : 400}
                  fill={isLast ? "var(--series-present)" : "var(--muted-foreground)"}
                >
                  {payload.value}
                </text>
              );
            }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            formatter={(value, name) => [`${Math.round(Number(value))}%`, name]}
            isAnimationActive={false}
          />
          {!hidden.presentPct && (
            <Area
              dataKey="presentPct"
              stroke="none"
              fill="var(--series-present)"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
          )}
          {RATE_SERIES.map((s) =>
            hidden[s.key] ? null : (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                dot={s.dot ? rateDot(s.color, lastIndex) : false}
                isAnimationActive={false}
              >
                {s.key === "presentPct" && (
                  <LabelList
                    dataKey="presentPct"
                    position="top"
                    formatter={(v) => `${Math.round(Number(v))}%`}
                    style={{ fill: "var(--series-present)", fontSize: 12, fontWeight: 700 }}
                  />
                )}
              </Line>
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Mini bar-per-day indicator for a KPI card (dashboard-fix-3) — replaces the
 * old Sparkline: bars carry an hover-able exact value, a flat/zero series
 * says so in words instead of drawing a flat line that reads as "no data
 * shown" rather than "genuinely zero every day".
 */
export function KpiMiniBars({
  data,
  color,
  unit = "คน",
  emptyLabel = "ไม่มีข้อมูลในช่วงนี้",
}: {
  data: { label: string; value: number }[];
  color: string;
  unit?: string;
  emptyLabel?: string;
}) {
  if (data.length === 0) return null;
  const allZero = data.every((d) => d.value === 0);
  if (allZero) {
    return (
      <div className="flex h-[34px] items-center justify-center rounded-md bg-surface-muted px-2 text-center text-[10px] leading-tight text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: 34 }}>
        {data.map((d, i) => {
          const isToday = i === data.length - 1;
          return (
            <div
              key={i}
              title={`${d.label}: ${d.value} ${unit}`}
              className="min-w-[3px] flex-1 rounded-[2px]"
              style={{
                height: Math.max(2, (d.value / max) * 34),
                background: isToday ? color : "var(--chart-muted-bar)",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0].label}</span>
        <span>วันนี้</span>
      </div>
    </div>
  );
}

/** Small legend for the donut, colored to match. */
export function DonutLegend({ data }: { data: DeptDatum[] }) {
  const colors = useCategoryColors();
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: colorFor(colors, i, d.name === "อื่นๆ") }}
            />
            <span className="text-muted-foreground">{d.name}</span>
          </span>
          <span className="font-medium tabular-nums">
            {d.count}
            <span className="ml-1 text-xs text-muted-foreground">
              {total ? `${Math.round((d.count / total) * 100)}%` : "0%"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
