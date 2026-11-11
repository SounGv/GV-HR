import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const toneMap: Record<Tone, string> = {
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/20 bg-info/10 text-info",
  muted: "border-border bg-muted text-muted-foreground",
};

/** The thin colour edge along the top of the card, same idea as the dashboard's status tiles. */
const edgeMap: Record<Tone, string> = {
  primary: "before:bg-primary",
  success: "before:bg-success",
  warning: "before:bg-[#d97706]",
  danger: "before:bg-destructive",
  info: "before:bg-info",
  muted: "before:bg-[#94a3b8]",
};

/** KPI stat card used across dashboards. `chart` renders an optional sparkline. */
export function StatCard({
  label,
  value,
  unit,
  delta,
  icon: Icon,
  tone = "primary",
  chart,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; direction?: "up" | "down" };
  icon?: LucideIcon;
  tone?: Tone;
  chart?: React.ReactNode;
  className?: string;
}) {
  const dir = delta ? (delta.direction ?? (delta.value >= 0 ? "up" : "down")) : undefined;
  const positive = dir === "up";

  return (
    <Card className={cn("relative gap-0 p-4 pt-5 before:absolute before:inset-x-0 before:top-0 before:h-1", edgeMap[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          {Icon && (
            <span className={cn("flex size-[30px] items-center justify-center rounded-lg border", toneMap[tone])}>
              <Icon className="size-4" />
            </span>
          )}
          <span>{label}</span>
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-[26px] leading-tight font-bold text-foreground tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      {chart && <div className="mt-3 h-10">{chart}</div>}
    </Card>
  );
}
