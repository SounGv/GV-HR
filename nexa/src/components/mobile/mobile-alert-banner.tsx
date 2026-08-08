"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "warning" | "success" | "destructive";

const VARIANT: Record<
  BannerVariant,
  { icon: typeof Info; container: string; iconClass: string }
> = {
  info: {
    icon: Info,
    container: "border-info/30 bg-info/10 text-info-foreground",
    iconClass: "text-info",
  },
  warning: {
    icon: AlertTriangle,
    container: "border-warning/30 bg-warning/10 text-warning-foreground",
    iconClass: "text-warning",
  },
  success: {
    icon: CheckCircle2,
    container: "border-success/30 bg-success/10 text-success-foreground",
    iconClass: "text-success",
  },
  destructive: {
    icon: AlertTriangle,
    container: "border-destructive/30 bg-destructive-muted text-destructive",
    iconClass: "text-destructive",
  },
};

export interface MobileAlertBannerProps {
  variant?: BannerVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}

export function MobileAlertBanner({
  variant = "info",
  title,
  description,
  onDismiss,
  className,
}: MobileAlertBannerProps) {
  const cfg = VARIANT[variant];
  const Icon = cfg.icon;

  return (
    <div className={cn("flex gap-3 rounded-2xl border px-4 py-3", cfg.container, className)}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", cfg.iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="ปิด"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-black/5"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export interface MobileSuccessCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function MobileSuccessCard({ title, description, action, className }: MobileSuccessCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-success/30 bg-success-muted px-6 py-8 text-center",
        className,
      )}
    >
      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="size-7" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 w-full">{action}</div> : null}
    </div>
  );
}
