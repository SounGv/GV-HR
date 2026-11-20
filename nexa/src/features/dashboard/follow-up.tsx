import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { GvIconTile } from "@/components/shared/gv-icons";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";

/**
 * How urgent a "ต้องตามวันนี้" card is: the icon chip, status word, number and
 * top wash follow it. `ok` is used automatically when the count is 0.
 */
export type FollowTone = "bad" | "warn" | "info" | "ok";

const TONE: Record<FollowTone, { word: string; num: string; wash: string }> = {
  bad: {
    word: "bg-[#fef2f2] text-[#b91c1c] dark:bg-[#3a1513] dark:text-[#fca5a0]",
    num: "text-[#b91c1c] dark:text-[#fca5a0]",
    wash: "from-[#fef2f2] dark:from-[#3a1513]/60",
  },
  warn: {
    word: "bg-[#fffbeb] text-[#a9500a] dark:bg-[#3a2a10] dark:text-[#f6b45c]",
    num: "text-[#0d47a1] dark:text-[#bbdefb]",
    wash: "from-[#eef6fd] dark:from-[#0b1626]",
  },
  info: {
    word: "bg-[#eff6ff] text-[#1d4ed8] dark:bg-[#13243a] dark:text-[#9cc3f2]",
    num: "text-[#0d47a1] dark:text-[#bbdefb]",
    wash: "from-[#eef6fd] dark:from-[#0b1626]",
  },
  ok: { word: "bg-[#e4f6ea] text-[#166534] dark:bg-[#12301e] dark:text-[#7ee2a3]", num: "", wash: "" },
};

/** Order the cards sit in (lower first), so the most urgent leads whatever loads first. */
export type FollowOrder = number;

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/**
 * The board the cards sit on: they wrap. Cards with nothing today are not drawn (the ticker covers them).
 * `items-start`, not `stretch`: opening one card's list must not stretch its neighbours to the same height
 * (owner, 14 Nov 2026: pressing one card opened all three).
 */
export const FOLLOW_BOARD_CLASS = "flex flex-wrap items-start gap-3.5";

const CARD =
  "relative flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 overflow-hidden rounded-lg border border-border bg-card p-4  transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5  motion-reduce:transition-none motion-reduce:hover:translate-y-0 ";

/**
 * One card on the dashboard's "ต้องตามวันนี้" board (owner-approved mock, 14 Nov
 * 2026): the icon, title and a big number up top, the status word, the first
 * names, the full list behind "ดูรายชื่อทั้งหมด" (a native `<details>`, works
 * without JavaScript) and the page to act on as a 44px button. A card with
 * nothing to follow is not drawn; the news ticker lists it as "ไม่มีวันนี้".
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
  open = false,
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
  /** Names behind the count; the first three are shown on the card. An entry can carry the photo address (`avatarUrl`) to show the photo instead of the initials. */
  people?: (string | { id?: string; name: string; avatarUrl?: string | null; gender?: string | null })[];
  /** Show `children` right on the card instead of behind "ดูรายละเอียด" (short lists). */
  open?: boolean;
}) {
  if (count <= 0) {
    // Not drawn: the news ticker on the hero reads this and says "ไม่มีวันนี้: …" once for all of them.
    return <span hidden data-follow-clear={title} />;
  }

  // One entry per name (the first photo wins); a plain string has no photo and no gender (the neutral character is drawn).
  const faces = new Map<string, { photo: string | null; gender: string | null; seed: string }>();
  for (const p of people) {
    const name = typeof p === "string" ? p : p.name;
    const photo = typeof p === "string" ? null : (p.avatarUrl ?? null);
    const gender = typeof p === "string" ? null : (p.gender ?? null);
    const seed = typeof p === "string" ? name : (p.id ?? name);
    const have = faces.get(name);
    if (!have || (!have.photo && photo)) faces.set(name, { photo, gender, seed });
  }
  const names = [...faces.keys()];
  return (
    <article
      data-follow-card
      data-follow-title={title}
      data-follow-tone={tone}
      data-follow-count={display ?? count}
      data-follow-unit={unit}
      data-follow-tag={tag}
      data-follow-names={names.slice(0, 2).join(", ")}
      data-follow-href={link?.href ?? "#follow-up"}
      style={{ order }}
      aria-label={`${title} ${display ?? count} ${unit}`} className={CARD}>
      <div className="relative flex items-start gap-3">
        <GvIconTile icon={Icon} status={tone} />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block text-[15.5px] leading-snug font-semibold text-foreground">{title}</span>
          {sub && <span className="block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>}
        </span>
        <span className="shrink-0 text-right leading-snug">
          <span className={cn("block text-[34px] font-bold tabular-nums", TONE[tone].num)}>{display ?? count}</span>
          <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{unit}</span>
        </span>
      </div>
      {tag && (
        <span className={cn("relative inline-flex self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold", TONE[tone].word)}>
          {tone === "info" ? "i" : "!"} {tag}
        </span>
      )}
      {names.length > 0 && (
        <ul className="relative flex flex-col">
          {names.slice(0, 3).map((n) => (
            <li key={n} className="flex min-h-9 items-center gap-2 border-t border-dashed border-border text-[13.5px] first:border-t-0">
              <PersonAvatar name={n} gender={faces.get(n)!.gender} seed={faces.get(n)!.seed} src={faces.get(n)!.photo} className="size-7 border border-border text-xs font-bold" />
              <span className="min-w-0 font-medium break-words">{n}</span>
            </li>
          ))}
          {names.length > 3 && <li className="pt-1 text-[12.5px] text-muted-foreground">และอีก {names.length - 3} คน</li>}
        </ul>
      )}
      {children && open && <div className="relative">{children}</div>}
      {children && !open && (
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
            "relative mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border px-3 text-[14px] font-semibold transition-colors",
            tone === "bad"
              ? "border-transparent bg-[#0d47a1] text-white  hover:brightness-110"
              : "border-border bg-[#eef6fd] text-[#0d47a1] hover:bg-[#e3f2fd] dark:bg-[#0b1626] dark:text-[#bbdefb]",
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
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
      <span className="size-11 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <span className="h-4 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
    </div>
  );
}
