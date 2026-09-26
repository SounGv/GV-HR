"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { ReportSummaryDatum } from "./types";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
};

/** More than this many categories along the X axis start colliding into an
 * unreadable block of overlapping labels — switch to a ranked horizontal
 * list instead, same reasoning as dashboard-charts.tsx's HeadcountBar. */
const HORIZONTAL_THRESHOLD = 6;

/** Wraps a category label onto 2 lines at the nearest space to its midpoint,
 * instead of Recharts' default single-line tick that just runs labels into
 * each other once the chart has more than a couple of departments. */
function TwoLineTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const text = payload?.value ?? "";
  const mid = Math.ceil(text.length / 2);
  let splitAt = text.lastIndexOf(" ", mid);
  if (splitAt <= 0) splitAt = text.indexOf(" ", mid);
  const [line1, line2] = splitAt > 0 ? [text.slice(0, splitAt), text.slice(splitAt + 1)] : [text, ""];
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
      <tspan x={x}>{line1}</tspan>
      {line2 && <tspan x={x} dy={14}>{line2}</tspan>}
    </text>
  );
}

/** Department-level rollup chart shown above a report's table, when the report provides one. */
export function ReportSummaryChart({
  data,
  label,
  unit,
}: {
  data: ReportSummaryDatum[];
  label?: string;
  unit?: string;
}) {
  if (data.length === 0) return null;

  const horizontal = data.length > HORIZONTAL_THRESHOLD;
  const height = horizontal ? Math.max(220, data.length * 32) : 220;

  return (
    <Card className="gap-3 p-4">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { top: 8, right: 24, bottom: 8, left: 4 } : { top: 8, right: 8, bottom: 24, left: -16 }}
        >
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={180}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                tick={<TwoLineTick />}
                tickLine={false}
                axisLine={false}
                interval={0}
                height={40}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value).toLocaleString("th-TH")} ${unit ?? ""}`.trim(), ""]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={horizontal ? 20 : 56}
            fill="var(--chart-1)"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
