import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerTone = "success" | "danger";

const TONE: Record<BannerTone, { wrap: string; icon: typeof Check }> = {
  success: {
    wrap: "border-success/20 bg-success-muted text-success",
    icon: Check,
  },
  danger: {
    wrap: "border-destructive/20 bg-destructive-muted text-destructive",
    icon: AlertTriangle,
  },
};

export function MobileAlertBanner({
  tone,
  children,
  className,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon: Icon } = TONE[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-xl border p-3.5 text-[13px] leading-relaxed", wrap, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function MobileSuccessCard({
  title,
  subtitle,
  rows,
  action,
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: React.ReactNode; highlight?: boolean }[];
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3.5 flex size-14 items-center justify-center rounded-full bg-success-muted">
        <Check className="size-7 text-success" />
      </div>
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-4 space-y-2 rounded-[10px] bg-surface-muted p-3.5 text-left text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={cn("font-semibold text-foreground", row.highlight && "text-success")}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
