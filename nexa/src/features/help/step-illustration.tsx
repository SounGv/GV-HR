import { Check, MousePointerClick, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IllustrationKind = "nav" | "form" | "select" | "button" | "review" | "notify";

/**
 * A small schematic mockup per step — not a real screenshot (none of the
 * actual app's screens are captured anywhere in this codebase), but built
 * from the same design tokens/shapes as the real UI so it reads as "this app",
 * not a generic stock graphic. One shared component per interaction *kind*
 * keeps ~20 guide steps visually consistent instead of one-off per step.
 */
export function StepIllustration({
  kind,
  icon: Icon,
  label,
  chips,
}: {
  kind: IllustrationKind;
  icon: LucideIcon;
  label?: string;
  chips?: string[];
}) {
  return (
    <div className="flex h-24 w-full items-center justify-center rounded-xl border border-border bg-muted/50 p-3">
      {kind === "nav" && (
        <div className="w-full max-w-[220px] space-y-1.5">
          <Row className="bg-transparent text-muted-foreground" icon={Icon} />
          <Row className="relative bg-primary text-primary-foreground shadow-sm" icon={Icon} label={label}>
            <MousePointerClick className="absolute -right-1.5 -bottom-1.5 size-4 rotate-[-8deg] text-foreground" />
          </Row>
          <Row className="bg-transparent text-muted-foreground" icon={Icon} />
        </div>
      )}

      {kind === "form" && (
        <div className="w-full max-w-[220px] space-y-1.5">
          <div className="h-2 w-14 rounded-full bg-muted-foreground/30" />
          <div className="h-6 rounded-md border border-border bg-card" />
          <div className="h-2 w-20 rounded-full bg-muted-foreground/30" />
          <div className="h-6 rounded-md border border-border bg-card" />
        </div>
      )}

      {kind === "select" && (
        <div className="flex w-full max-w-[220px] flex-wrap gap-1.5">
          {(chips ?? ["ตัวเลือก 1", "ตัวเลือก 2", "ตัวเลือก 3"]).map((c, i) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] font-medium",
                i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
              )}
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {kind === "button" && (
        <div className="flex w-full max-w-[220px] flex-col items-center gap-2">
          <div className="h-2 w-24 rounded-full bg-muted-foreground/25" />
          <div className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
            <Icon className="size-3.5" />
            {label}
          </div>
        </div>
      )}

      {kind === "review" && (
        <div className="w-full max-w-[220px] space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
              <div className={cn("h-2 rounded-full bg-muted-foreground/25", i === 0 ? "w-24" : i === 1 ? "w-16" : "w-20")} />
            </div>
          ))}
        </div>
      )}

      {kind === "notify" && (
        <div className="flex items-center gap-2">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon className="size-4.5" />
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-muted/50" />
          </span>
          <div className="space-y-1 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-sm">
            <div className="h-1.5 w-20 rounded-full bg-muted-foreground/30" />
            <div className="h-1.5 w-14 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  className,
  icon: Icon,
  label,
  children,
}: {
  className?: string;
  icon: LucideIcon;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5", className)}>
      <Icon className="size-3" />
      {label && <span className="truncate text-[10.5px] font-medium">{label}</span>}
      {children}
    </div>
  );
}
