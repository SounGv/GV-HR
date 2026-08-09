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

  return (
    <Card className="gap-3 p-4">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value).toLocaleString("th-TH")} ${unit ?? ""}`.trim(), ""]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
