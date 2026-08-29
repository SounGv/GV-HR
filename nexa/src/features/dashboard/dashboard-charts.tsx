"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DeptDatum } from "./group-departments";
import type { AttendanceTrendPoint } from "./service";

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
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius={62}
          outerRadius={95}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(colors, i, d.name === "อื่นๆ")} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Truncate a long department name for axis ticks; full name still shows in the tooltip. */
function truncate(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function HeadcountBar({ data }: { data: DeptDatum[] }) {
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
          tickFormatter={truncate}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [`${value} คน`, "จำนวน"]}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={colorFor(colors, i, false)} opacity={i < colors.length ? 1 : 0.45} />
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
 * glance instead of needing to compare daily reports by hand. */
export function AttendanceTrendChart({ data }: { data: AttendanceTrendPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 600, marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {TREND_SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
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
