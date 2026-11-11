import { cn } from "@/lib/utils";

/**
 * One status chip for the whole app. Replaces the ~10 per-module copies of the
 * `rounded-full … + dot` markup. Semantic tone is separate from the accent hue.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "primary" | "neutral";

const TONE: Record<StatusTone, string> = {
  success: "border-success/25 bg-success-muted text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive-muted text-destructive",
  info: "border-accent-foreground/20 bg-accent text-accent-foreground",
  primary: "border-accent-foreground/20 bg-accent text-accent-foreground",
  neutral: "border-border bg-surface-muted text-muted-foreground",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {label}
    </span>
  );
}
