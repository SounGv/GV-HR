import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

import { avatarInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * How urgent a "ต้องตามวันนี้" row is: the icon chip, status word and count
 * pill follow it. `ok` is used automatically when the count is 0.
 */
export type FollowTone = "bad" | "warn" | "info" | "ok";

const TONE: Record<FollowTone, { chip: string; word: string; pill: string }> = {
  bad: { chip: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]", word: "text-[#b91c1c]", pill: "bg-[#fef2f2] text-[#991b1b] ring-[#fecaca]" },
  warn: { chip: "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]", word: "text-[#b45309]", pill: "bg-[#fffbeb] text-[#92400e] ring-[#fde68a]" },
  info: { chip: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]", word: "text-[#1d4ed8]", pill: "bg-[#eff6ff] text-[#1e40af] ring-[#bfdbfe]" },
  ok: { chip: "bg-[#f0fdf4] text-[#15803d] ring-[#bbf7d0]", word: "text-[#15803d]", pill: "" },
};

/** Order the rows sit in (lower first), so the most urgent stays on top whatever loads first. */
export type FollowOrder = number;

const AVATAR_TINT = ["bg-[#ccfbf1] text-[#0f766e]", "bg-[#fef3c7] text-[#92400e]", "bg-[#e0e7ff] text-[#3730a3]"];


/** Up to three overlapping initials + "+N" (wide cards only), so the names read at a glance. */
function Faces({ names }: { names: string[] }) {
  const uniq = [...new Set(names)];
  if (uniq.length === 0) return null;
  return (
    <span className="hidden shrink-0 items-center @[30rem]:flex" aria-hidden="true">
      {uniq.slice(0, 3).map((n, i) => (
        <span
          key={n}
          className={cn(
            "-ml-1.5 flex size-7 items-center justify-center rounded-full text-[10.5px] font-bold ring-2 ring-card first:ml-0",
            AVATAR_TINT[i % AVATAR_TINT.length],
          )}
        >
          {avatarInitials(n)}
        </span>
      ))}
      {uniq.length > 3 && (
        <span className="-ml-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-1.5 text-[10.5px] font-bold text-muted-foreground tabular-nums ring-2 ring-card">
          +{uniq.length - 3}
        </span>
      )}
    </span>
  );
}

/**
 * One row of the dashboard's "ต้องตามวันนี้" list. The card it sits in is a
 * size container (`@container`), so the row reads well from a phone-wide
 * column up: a one-line title, a one-line sub led by the status word in the
 * row's colour, and the count in a tinted pill; wide cards add the first few
 * faces and a chevron. Rows with nothing to follow sink to the end as a
 * short "ไม่มีวันนี้" line. A row with something to show opens in place (a
 * native `<details>`, so it works without JavaScript) to the names and a
 * link. Server- and client-safe (no hooks).
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
  people = [],
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  count: number;
  unit: string;
  /** Urgency when count > 0; a zero count is always shown as `ok`. */
  tone: Exclude<FollowTone, "ok">;
  /** Status word when count > 0 (e.g. "รอแก้เวลา"); zero shows "ไม่มีวันนี้". */
  tag: string;
  order: FollowOrder;
  /** The opened part: names, groups, buttons. */
  children?: ReactNode;
  link?: { href: string; label: string };
  /** Number to show instead of `count` (e.g. "46.5"); the count still decides the tone. */
  display?: string;
  /** Names behind the count, for the faces on wide cards. */
  people?: string[];
}) {
  if (count <= 0) {
    // Nothing to follow: a short muted line at the end of the list.
    return (
      <div
        className="flex items-center gap-3 border-t border-[#eef1f3] px-4 py-2 dark:border-border"
        style={{ order: 100 + order }}
      >
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", TONE.ok.chip)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{title}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold", TONE.ok.word)}>
          <Check className="size-3.5" aria-hidden="true" /> ไม่มีวันนี้
        </span>
      </div>
    );
  }

  const opens = Boolean(children || link);
  const head = (
    <>
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", TONE[tone].chip)}>
        <Icon className="size-[19px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] leading-snug font-semibold text-foreground">{title}</span>
        <span className="block truncate text-[12.5px] leading-snug text-muted-foreground">
          <b className={cn("font-semibold", TONE[tone].word)}>{tag}</b>
          {sub && <> · {sub}</>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <Faces names={people} />
        <span className={cn("inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5 ring-1 ring-inset", TONE[tone].pill)}>
          <span className="text-[17px] leading-tight font-bold tabular-nums">{display ?? count}</span>
          <span className="text-[11px] font-medium">{unit}</span>
        </span>
      </span>
    </>
  );
  const rowClass =
    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 @[30rem]:grid-cols-[auto_minmax(0,1fr)_auto_auto] @[30rem]:px-[18px]";

  if (!opens) {
    return (
      <div className={cn(rowClass, "border-t border-[#eef1f3] dark:border-border")} style={{ order }}>
        {head}
      </div>
    );
  }
  return (
    <details className="group border-t border-[#eef1f3] dark:border-border" style={{ order }}>
      <summary
        className={cn(rowClass, "cursor-pointer list-none transition-colors hover:bg-[var(--row-hover,#f6f8f9)] [&::-webkit-details-marker]:hidden")}
      >
        {head}
        <ChevronRight
          className="hidden size-4 text-muted-foreground transition-transform group-open:rotate-90 @[30rem]:block"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-2 border-t border-dashed border-border bg-[#fbfcfc] px-4 pt-2 pb-3 @[30rem]:pl-[70px] dark:bg-transparent">
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
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-t border-[#eef1f3] px-4 py-3 dark:border-border"
      style={{ order }}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-[19px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14.5px] leading-snug font-semibold text-foreground">{title}</span>
        <span className="block text-[12.5px] text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</span>
      </span>
    </div>
  );
}

/** Placeholder row while a slow row loads. */
export function FollowRowLoading({ order }: { order: FollowOrder }) {
  return (
    <div className="flex items-center gap-3 border-t border-[#eef1f3] px-4 py-3 dark:border-border" style={{ order }}>
      <span className="size-10 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </div>
  );
}
