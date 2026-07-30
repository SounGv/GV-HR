import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const toneMap: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
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
    <Card className={cn("gap-0 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {Icon && (
            <span className={cn("flex size-6 items-center justify-center rounded-md", toneMap[tone])}>
              <Icon className="size-3.5" />
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
        <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>

      {chart && <div className="mt-3 h-10">{chart}</div>}
    </Card>
  );
}
