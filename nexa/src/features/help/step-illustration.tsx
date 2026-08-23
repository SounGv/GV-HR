import { Check, MousePointerClick, Camera, MapPin, ThumbsUp, ThumbsDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IllustrationKind =
  | "login"
  | "nav"
  | "tabs"
  | "form"
  | "select"
  | "button"
  | "review"
  | "notify"
  | "checkin"
  | "payslip"
  | "approve"
  | "dashboard";

/**
 * Small schematic mockups for readers with zero HR-software background —
 * built from the same shapes/colors as the real UI (dark sidebar, lime
 * primary, card borders) so they read as "this app", not stock graphics.
 * One shared component per interaction *kind* keeps a large guide visually
 * consistent instead of one bespoke drawing per step.
 */
export function StepIllustration({
  kind,
  icon: Icon,
  label,
  chips,
  lines,
}: {
  kind: IllustrationKind;
  icon?: LucideIcon;
  label?: string;
  chips?: string[];
  lines?: { label: string; amount: string }[];
}) {
  return (
    <div className="flex min-h-24 w-full items-center justify-center rounded-xl border border-border bg-muted/50 p-3">
      {kind === "login" && (
        <div className="w-full max-w-[220px] space-y-1.5">
          <div className="h-2 w-16 rounded-full bg-muted-foreground/30" />
          <div className="h-6 rounded-md border border-border bg-card px-2 text-[9px] text-muted-foreground leading-6">
            somchai@company.com
          </div>
          <div className="h-6 rounded-md border border-border bg-card px-2 text-[9px] text-muted-foreground leading-6">
            ••••••••
          </div>
          <div className="flex h-7 items-center justify-center rounded-md bg-primary text-[10.5px] font-bold text-primary-foreground">
            เข้าสู่ระบบ
          </div>
        </div>
      )}

      {kind === "nav" && (
        <div className="w-full max-w-[220px] space-y-1 rounded-lg bg-sidebar p-2">
          <Row className="text-slate-400" icon={Icon} />
          <Row className="relative bg-primary text-primary-foreground shadow-sm" icon={Icon} label={label}>
            <MousePointerClick className="absolute -right-1.5 -bottom-1.5 size-4 rotate-[-8deg] text-white" />
          </Row>
          <Row className="text-slate-400" icon={Icon} />
        </div>
      )}

      {kind === "tabs" && (
        <div className="w-full max-w-[220px] space-y-1.5">
          <div className="flex gap-1 text-[9px] font-semibold">
            {(chips ?? ["ข้อมูลส่วนตัว", "การจ้างงาน", "เงินเดือน"]).map((c, i) => (
              <span
                key={c}
                className={cn("rounded-full px-2 py-1", i === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="h-2 w-14 rounded-full bg-muted-foreground/30" />
          <div className="h-6 rounded-md border border-border bg-card" />
          <div className="h-2 w-20 rounded-full bg-muted-foreground/30" />
          <div className="h-6 rounded-md border border-border bg-card" />
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
            {Icon && <Icon className="size-3.5" />}
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
            {Icon && <Icon className="size-4.5" />}
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-muted/50" />
          </span>
          <div className="space-y-1 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-sm">
            <div className="h-1.5 w-20 rounded-full bg-muted-foreground/30" />
            <div className="h-1.5 w-14 rounded-full bg-muted-foreground/20" />
          </div>
        </div>
      )}

      {kind === "checkin" && (
        <div className="flex w-full max-w-[220px] flex-col items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9.5px] font-semibold text-secondary-foreground">
            <MapPin className="size-2.5" /> อยู่ในระยะ
          </span>
          <div className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-[12px] font-bold text-primary-foreground shadow-sm">
            <Camera className="size-4" /> เช็คอิน
          </div>
        </div>
      )}

      {kind === "payslip" && (
        <div className="w-full max-w-[220px] space-y-1">
          {(lines ?? [
            { label: "เงินเดือน", amount: "35,000" },
            { label: "ประกันสังคม", amount: "-750" },
            { label: "ภาษี", amount: "-171" },
          ]).map((l) => (
            <div key={l.label} className="flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground">{l.label}</span>
              <span className={cn("font-semibold", l.amount.startsWith("-") ? "text-destructive" : "text-foreground")}>
                {l.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      {kind === "dashboard" && (
        <div className="w-full max-w-[240px] space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { n: "42", l: "เสร็จแล้ว" },
              { n: "8", l: "ยังไม่ทำ" },
              { n: "76.4%", l: "ค่าเฉลี่ย" },
            ].map((k) => (
              <div key={k.l} className="rounded-md border border-border bg-card p-1.5 text-center">
                <p className="text-[11px] font-bold text-foreground">{k.n}</p>
                <p className="text-[8px] text-muted-foreground">{k.l}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1 rounded-md border border-border bg-card p-2">
            {[70, 45, 90].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {kind === "approve" && (
        <div className="flex w-full max-w-[220px] gap-2">
          <div className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-success/15 text-[10.5px] font-bold text-success">
            <ThumbsUp className="size-3.5" /> อนุมัติ
          </div>
          <div className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border text-[10.5px] font-bold text-muted-foreground">
            <ThumbsDown className="size-3.5" /> ไม่อนุมัติ
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
  icon?: LucideIcon;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5", className)}>
      {Icon && <Icon className="size-3" />}
      {label && <span className="truncate text-[10.5px] font-medium">{label}</span>}
      {children}
    </div>
  );
}
