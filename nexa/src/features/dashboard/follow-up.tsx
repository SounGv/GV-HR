import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";

import { avatarInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * How urgent a "ต้องตามวันนี้" card is: the icon chip, status word, number and
 * top wash follow it. `ok` is used automatically when the count is 0.
 */
export type FollowTone = "bad" | "warn" | "info" | "ok";

const TONE: Record<FollowTone, { chip: string; word: string; num: string; wash: string }> = {
  bad: {
    chip: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca] dark:bg-[#3a1513] dark:text-[#fca5a0] dark:ring-[#6e2522]",
    word: "bg-[#fef2f2] text-[#b91c1c] dark:bg-[#3a1513] dark:text-[#fca5a0]",
    num: "text-[#b91c1c] dark:text-[#fca5a0]",
    wash: "from-[#fef2f2] dark:from-[#3a1513]/60",
  },
  warn: {
    chip: "bg-[#fffbeb] text-[#b45309] ring-[#fde68a] dark:bg-[#3a2a10] dark:text-[#f6b45c] dark:ring-[#6b4e12]",
    word: "bg-[#fffbeb] text-[#a9500a] dark:bg-[#3a2a10] dark:text-[#f6b45c]",
    num: "text-[#0b4f4a] dark:text-[#99f6e4]",
    wash: "from-[#f0f9f7] dark:from-[#13201e]",
  },
  info: {
    chip: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe] dark:bg-[#13243a] dark:text-[#9cc3f2] dark:ring-[#24405f]",
    word: "bg-[#eff6ff] text-[#1d4ed8] dark:bg-[#13243a] dark:text-[#9cc3f2]",
    num: "text-[#0b4f4a] dark:text-[#99f6e4]",
    wash: "from-[#f0f9f7] dark:from-[#13201e]",
  },
  ok: { chip: "", word: "bg-[#e4f6ea] text-[#166534] dark:bg-[#12301e] dark:text-[#7ee2a3]", num: "", wash: "" },
};

/** Order the cards sit in (lower first), so the most urgent leads whatever loads first. */
export type FollowOrder = number;

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/** The board the cards sit on: they wrap, and the "nothing today" chips sink to the end. */
export const FOLLOW_BOARD_CLASS = "flex flex-wrap items-stretch gap-3.5";

const CARD =
  "relative flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 overflow-hidden rounded-[20px] border border-border bg-card p-4 shadow-[0_2px_4px_rgba(11,40,37,.06),0_12px_28px_rgba(11,40,37,.10)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(11,40,37,.08),0_18px_36px_rgba(11,40,37,.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:shadow-[0_8px_24px_rgba(0,0,0,.45)]";

/**
 * One card on the dashboard's "ต้องตามวันนี้" board (owner-approved mock, 14 Nov
 * 2026): the icon, title and a big number up top, the status word, the first
 * names, the full list behind "ดูรายชื่อทั้งหมด" (a native `<details>`, works
 * without JavaScript) and the page to act on as a 44px button. A card with
 * nothing to follow shrinks to a "✓ … ไม่มีวันนี้" chip at the end of the board.
 * Server- and client-safe (no hooks).
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
  icon: IconType;
  title: string;
  sub: string;
  count: number;
  unit: string;
  /** Urgency when count > 0; a zero count is always shown as `ok`. */
  tone: Exclude<FollowTone, "ok">;
  /** Status word when count > 0 (e.g. "รอแก้เวลา"); zero shows "ไม่มีวันนี้". */
  tag: string;
  order: FollowOrder;
  /** The full list: names, groups, buttons. */
  children?: ReactNode;
  link?: { href: string; label: string };
  /** Number to show instead of `count` (e.g. "46.5"); the count still decides the tone. */
  display?: string;
  /** Names behind the count; the first three are shown on the card. */
  people?: string[];
}) {
  if (count <= 0) {
    return (
      <span
        style={{ order: 100 + order }}
        className={cn("inline-flex min-h-9 flex-none items-center gap-1.5 self-center rounded-full px-3 text-[13px] font-semibold", TONE.ok.word)}
      >
        <Check className="size-3.5" aria-hidden="true" /> {title} ไม่มีวันนี้
      </span>
    );
  }

  const names = [...new Set(people)];
  return (
    <article data-follow-card style={{ order }} aria-label={`${title} ${display ?? count} ${unit}`} className={CARD}>
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", TONE[tone].wash)} />
      <div className="relative flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-[14px] ring-1 ring-inset shadow-[0_1px_2px_rgba(11,40,37,.08)]", TONE[tone].chip)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-[15.5px] leading-snug font-semibold text-foreground">{title}</span>
          {sub && <span className="block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>}
        </span>
        <span className="shrink-0 text-right leading-none">
          <span className={cn("block text-[34px] font-bold tabular-nums", TONE[tone].num)}>{display ?? count}</span>
          <span className="mt-1 block text-[12px] text-muted-foreground">{unit}</span>
        </span>
      </div>
      <span className={cn("relative inline-flex self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold", TONE[tone].word)}>
        {tone === "info" ? "i" : "!"} {tag}
      </span>
      {names.length > 0 && (
        <ul className="relative flex flex-col">
          {names.slice(0, 3).map((n) => (
            <li key={n} className="flex min-h-9 items-center gap-2 border-t border-dashed border-border text-[13.5px] first:border-t-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-[#f0f9f7] text-[11px] font-bold text-[#0b4f4a] dark:bg-[#13201e] dark:text-[#99f6e4]">
                {avatarInitials(n)}
              </span>
              <span className="min-w-0 font-medium break-words">{n}</span>
            </li>
          ))}
          {names.length > 3 && <li className="pt-1 text-[12.5px] text-muted-foreground">และอีก {names.length - 3} คน</li>}
        </ul>
      )}
      {children && (
        <details className="group relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13.5px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
            ดูรายละเอียด
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="space-y-2 pt-1">{children}</div>
        </details>
      )}
      {link && (
        <Link
          href={link.href}
          className={cn(
            "relative mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-[13px] border px-3 text-[14px] font-semibold transition-colors",
            tone === "bad"
              ? "border-transparent bg-[linear-gradient(135deg,#0f766e,#0b4f4a)] text-white shadow-[0_8px_18px_rgba(13,148,136,.22)] hover:brightness-110"
              : "border-border bg-[#f0f9f7] text-[#0b4f4a] hover:bg-[#ddf3ef] dark:bg-[#13201e] dark:text-[#99f6e4]",
          )}
        >
          {link.label} <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

/** A card that failed to load, in the same slot so the board keeps its shape. */
export function FollowRowFailed({ icon, title, what, order }: { icon: IconType; title: string; what: string; order: FollowOrder }) {
  const Icon = icon;
  return (
    <div style={{ order }} className={cn(CARD, "hover:translate-y-0")}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-[14px] bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] leading-snug font-semibold text-foreground">{title}</span>
          <span className="block text-[12.5px] text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</span>
        </span>
      </div>
    </div>
  );
}

/** Placeholder card while a slow card loads. */
export function FollowRowLoading({ order }: { order: FollowOrder }) {
  return (
    <div style={{ order }} className={cn(CARD, "min-h-[150px] hover:translate-y-0")}>
      <span className="size-11 animate-pulse rounded-[14px] bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </div>
  );
}
