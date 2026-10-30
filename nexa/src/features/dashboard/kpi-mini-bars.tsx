/**
 * Mini bar-per-day indicator for a KPI card (dashboard-fix-3) — replaces the
 * old Sparkline: bars carry an hover-able exact value, a flat/zero series
 * says so in words instead of drawing a flat line that reads as "no data
 * shown" rather than "genuinely zero every day".
 *
 * Kept in its own file, separate from dashboard-charts.tsx: this component
 * doesn't touch recharts at all (plain divs), so it stays a server-renderable
 * component importable straight from dashboard/page.tsx — recharts only
 * needs to be lazy-loaded (dashboard-charts-lazy.tsx) for the one chart that
 * actually uses it.
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
