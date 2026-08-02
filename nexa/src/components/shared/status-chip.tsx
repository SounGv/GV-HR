import { cn } from "@/lib/utils";

/**
 * One status chip for the whole app. Replaces the ~10 per-module copies of the
 * `rounded-full … + dot` markup. Semantic tone is separate from the accent hue.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "primary" | "neutral";

const TONE: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  primary: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusChip({
  tone = "neutral",
  label,
  dot = true,
  className,
}: {
  tone?: StatusTone;
  label: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {label}
    </span>
  );
}
