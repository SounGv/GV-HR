import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight, Info, TriangleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * How urgent a "ต้องตามวันนี้" row is: the left edge, icon chip and tag follow it.
 * `ok` is used automatically when the count is 0.
 */
export type FollowTone = "bad" | "warn" | "info" | "ok";

const TONE: Record<FollowTone, { edge: string; chip: string; tag: string }> = {
  bad: { edge: "#dc2626", chip: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]", tag: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]" },
  warn: { edge: "#d97706", chip: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]", tag: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]" },
  info: { edge: "#2563eb", chip: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]", tag: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" },
  ok: { edge: "#16a34a", chip: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]", tag: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]" },
};

const TAG_ICON: Record<FollowTone, LucideIcon> = { bad: TriangleAlert, warn: Info, info: Info, ok: Check };

/** Order the rows sit in (lower first), so the most urgent stays on top whatever loads first. */
export type FollowOrder = number;

/**
 * One row of the dashboard's "ต้องตามวันนี้" list (dashboard-v3-mock.html):
 * coloured edge by urgency, icon, title + one line, a status tag, a big
 * number with its unit, and a chevron. With something to show, the row opens
 * in place (a native `<details>`, so it works without JavaScript) to the
 * names and a link to the full page. Server- and client-safe (no hooks).
 */
export function FollowRow({
  icon: Icon,
  title,
  sub,
  count,
  unit,
  tone,
  tag,
  order,
  children,
  link,
  display,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  count: number;
  unit: string;
  /** Urgency when count > 0; a zero count is always shown as `ok`. */
  tone: Exclude<FollowTone, "ok">;
  /** Tag text when count > 0 (e.g. "รอแก้เวลา"); zero shows "ไม่มีวันนี้". */
  tag: string;
  order: FollowOrder;
  /** The opened part: names, groups, buttons. */
  children?: ReactNode;
  link?: { href: string; label: string };
  /** Number to show instead of `count` (e.g. "46.5"); the count still decides the tone. */
  display?: string;
}) {
  const t: FollowTone = count > 0 ? tone : "ok";
  const tagText = count > 0 ? tag : "ไม่มีวันนี้";
  const TagIcon = TAG_ICON[t];
  const head = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] border", TONE[t].chip)}>
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-snug font-semibold text-foreground">{title}</span>
        <span className="block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>
      </span>
      <span className={cn("hidden shrink-0 items-center gap-1 rounded-full border px-2.5 py-px text-[11.5px] font-semibold sm:inline-flex", TONE[t].tag)}>
        <TagIcon className="size-3" aria-hidden="true" />
        {tagText}
      </span>
      <span className="min-w-[64px] text-right text-2xl leading-none font-bold tabular-nums">
        {display ?? count}
        <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>
      </span>
    </>
  );
  const rowClass =
    "gv-edge grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3.5 px-4 py-3 sm:px-[18px]";
  const style = { "--edge": TONE[t].edge, order } as React.CSSProperties;
  const opens = count > 0 && (children || link);

  if (!opens) {
    return (
      <div className={cn(rowClass, "border-t border-[#eef1f3] first:border-t-0")} style={style}>
        {head}
        <span className="size-4" aria-hidden="true" />
      </div>
    );
  }
  return (
    <details className="group border-t border-[#eef1f3] first:border-t-0" style={{ order }}>
      <summary
        className={cn(rowClass, "cursor-pointer list-none transition-colors hover:bg-[var(--row-hover,#f6f8f9)] [&::-webkit-details-marker]:hidden")}
        style={{ "--edge": TONE[t].edge } as React.CSSProperties}
      >
        {head}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="space-y-2 border-t border-dashed border-border bg-[#fbfcfc] px-4 pt-2 pb-3 sm:pl-[68px] dark:bg-transparent">
        {children}
        {link && (
          <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            {link.label} <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </details>
  );
}

/** A row that failed to load, in the same slot so the list keeps its shape. */
export function FollowRowFailed({ icon, title, what, order }: { icon: LucideIcon; title: string; what: string; order: FollowOrder }) {
  const Icon = icon;
  return (
    <div
      className="gv-edge grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 border-t border-[#eef1f3] px-4 py-3 first:border-t-0 sm:px-[18px]"
      style={{ "--edge": "#94a3b8", order } as React.CSSProperties}
    >
      <span className="flex size-9 items-center justify-center rounded-[10px] border border-border bg-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] leading-snug font-semibold text-foreground">{title}</span>
        <span className="block text-[12.5px] text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</span>
      </span>
    </div>
  );
}

/** Placeholder row while a slow row loads. */
export function FollowRowLoading({ order }: { order: FollowOrder }) {
  return (
    <div className="flex items-center gap-3.5 border-t border-[#eef1f3] px-4 py-3 first:border-t-0 sm:px-[18px]" style={{ order }}>
      <span className="size-9 animate-pulse rounded-[10px] bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </div>
  );
}
