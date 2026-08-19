"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DeptDatum } from "./group-departments";

// A wider, distinct categorical palette (not just the 5 --chart-* tokens
// cycling and repeating every 5 slices — with ~19 departments that made
// several unrelated departments render in the exact same color). Colors
// stay in the brand's lime/teal/amber family with a few extra distinct
// hues mixed in so up to 9 real categories + "other" are all tellable apart.
const CATEGORY_COLORS = [
  "#84cc16", // lime (brand primary)
  "#0e9f8e", // teal
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#e4573d", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#4d7c0f", // olive
];
const OTHER_COLOR = "var(--muted-foreground)";

function colorFor(index: number, isOther: boolean): string {
  return isOther ? OTHER_COLOR : CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function DepartmentDonut({ data }: { data: DeptDatum[] }) {
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
            <Cell key={i} fill={colorFor(i, d.name === "อื่นๆ")} />
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
            <Cell key={i} fill={colorFor(i, false)} opacity={i < CATEGORY_COLORS.length ? 1 : 0.45} />
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

/** Small legend for the donut, colored to match. */
export function DonutLegend({ data }: { data: DeptDatum[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ background: colorFor(i, d.name === "อื่นๆ") }}
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
