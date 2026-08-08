"use client";

import Link from "next/link";
import { AlertTriangle, Check, MapPin, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileAlertBanner } from "./mobile-alert-banner";
import { MobileActionFooter, MobilePrimaryButton } from "./mobile-action-footer";
import { MobileSuccessCard } from "./mobile-alert-banner";

export type DemoState = "normal" | "blocked" | "success";

const DEMO_PILL: Record<
  DemoState,
  { label: string; border: string; bg: string; color: string }
> = {
  normal: { label: "ปกติ", border: "border-primary", bg: "bg-accent", color: "text-primary" },
  blocked: {
    label: "ติดเงื่อนไข",
    border: "border-destructive",
    bg: "bg-destructive-muted",
    color: "text-destructive",
  },
  success: {
    label: "สำเร็จ",
    border: "border-success",
    bg: "bg-success-muted",
    color: "text-success",
  },
};

/** Mockup preview toggles — normal / blocked / success states. */
export function MobileDemoPills({
  state,
  onChange,
  labels,
  className,
}: {
  state: DemoState;
  onChange: (state: DemoState) => void;
  labels?: Partial<Record<DemoState, string>>;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {(Object.keys(DEMO_PILL) as DemoState[]).map((key) => {
        const pill = DEMO_PILL[key];
        const active = state === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition active:scale-[0.99]",
              active
                ? cn(pill.border, pill.bg, pill.color)
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {labels?.[key] ?? pill.label}
          </button>
        );
      })}
    </div>
  );
}

export function MobileModuleCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rounded-xl bg-card p-4", className)}>{children}</div>;
}

export function MobileFieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[13px] font-semibold text-foreground">{children}</p>;
}

export function MobileBlockedAlert({
  children,
  icon: Icon = AlertTriangle,
}: {
  children: React.ReactNode;
  icon?: typeof AlertTriangle;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-destructive/20 bg-destructive-muted p-3.5 text-[13px] leading-relaxed text-[#8a2e1e]">
      <Icon className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function MobileDevNote({ children }: { children: React.ReactNode }) {
  return (
    <MobileAlertBanner tone="dev" className="text-[11px]">
      Dev note: {children}
    </MobileAlertBanner>
  );
}

export function MobileModuleLayout({
  demo,
  onDemoChange,
  demoLabels,
  blocked,
  success,
  children,
  footer,
  devNote,
}: {
  demo?: DemoState;
  onDemoChange?: (state: DemoState) => void;
  demoLabels?: Partial<Record<DemoState, string>>;
  blocked?: React.ReactNode;
  success?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  devNote?: React.ReactNode;
}) {
  const showDemo = demo && onDemoChange;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-3.5 p-3.5">
        {showDemo && (
          <MobileDemoPills state={demo} onChange={onDemoChange} labels={demoLabels} />
        )}
        {demo === "success" && success}
        {demo === "blocked" && blocked}
        {demo !== "success" && children}
        {devNote && <MobileDevNote>{devNote}</MobileDevNote>}
      </div>
      {footer && demo !== "success" && (
        <MobileActionFooter>{footer}</MobileActionFooter>
      )}
    </div>
  );
}

export function MobileSuccessScreen({
  title,
  subtitle,
  rows,
  backHref = "/services",
  backLabel = "กลับหน้าหลัก",
}: {
  title: string;
  subtitle?: string;
  rows?: { label: string; value: React.ReactNode; highlight?: boolean }[];
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="p-3.5">
      <MobileSuccessCard
        title={title}
        subtitle={subtitle}
        rows={rows ?? []}
        action={
          <Link href={backHref}>
            <MobilePrimaryButton>{backLabel}</MobilePrimaryButton>
          </Link>
        }
      />
    </div>
  );
}

export function MobileSelectBox({
  label,
  value,
  className,
}: {
  label?: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[10px] border border-border px-3 py-2.5", className)}>
      {label && <span className="block text-[10px] text-muted-foreground">{label}</span>}
      <span className="text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function MobileUploadZone({ label }: { label: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-border px-3 py-4 text-center text-muted-foreground">
      <p className="text-xs">{label}</p>
    </div>
  );
}

export function MobileStatusChip({
  label,
  tone = "primary",
}: {
  label: string;
  tone?: "primary" | "success" | "danger";
}) {
  const styles = {
    primary: "bg-accent text-primary",
    success: "bg-success-muted text-success",
    danger: "bg-destructive-muted text-destructive",
  }[tone];
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", styles)}>{label}</span>
  );
}

export function MobileInRangeHint({ distance }: { distance: string }) {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-success">
      <MapPin className="size-4" />
      อยู่ในระยะสำนักงานใหญ่ ({distance})
    </p>
  );
}

export function MobileOutOfRangeAlert({ distance, radius }: { distance: string; radius: string }) {
  return (
    <MobileBlockedAlert icon={MapPinOff}>
      คุณอยู่นอกระยะที่กำหนด — ห่างจากสำนักงานใหญ่ <b>{distance}</b> (รัศมีที่กำหนด {radius})
      เช็คอินไม่ได้จนกว่าจะเข้าพื้นที่ หรือขอสิทธิ์นอกสถานที่ล่วงหน้า
    </MobileBlockedAlert>
  );
}

export function MobileCameraPlaceholder() {
  return (
    <div className="mb-3 flex h-[180px] items-center justify-center rounded-xl bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_8px,#e8eaf0_8px,#e8eaf0_16px)] font-mono text-[11px] text-muted-foreground">
      กล้องหน้า + ตำแหน่ง GPS
    </div>
  );
}

export function MobileSectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="px-1 text-[13px] font-semibold text-foreground">{children}</h3>;
}

export function MobileDisabledButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="flex h-[50px] w-full items-center justify-center rounded-[10px] bg-muted text-sm font-bold text-muted-foreground"
    >
      {children}
    </button>
  );
}
