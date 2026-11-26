import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";

/**
 * How urgent a "ต้องตามวันนี้" card is: the solid icon tile, status chip, number and
 * when-labels follow it (bad = red, warn = amber, info = blue). `ok` is used
 * automatically when the count is 0.
 */
export type FollowTone = "bad" | "warn" | "info" | "ok";

/**
 * Solid fills, not tints (owner-approved mock, 26 Nov 2026). Amber carries dark ink, red and blue carry white.
 * Amber text on a white card is darkened (#7a5200) so the number and the date stay readable.
 */
const TONE: Record<FollowTone, { tile: string; chip: string; text: string }> = {
  bad: {
    tile: "bg-destructive text-destructive-foreground",
    chip: "bg-destructive text-destructive-foreground",
    text: "text-destructive",
  },
  warn: {
    tile: "bg-[#ffb900] text-[#3a2a00]",
    chip: "bg-[#ffb900] text-[#3a2a00]",
    text: "text-[#7a5200] dark:text-[#ffb900]",
  },
  info: {
    tile: "bg-[#1565c0] text-white",
    chip: "bg-[#1565c0] text-white",
    text: "text-[#1565c0] dark:text-[#64b5f6]",
  },
  ok: {
    tile: "bg-success text-success-foreground",
    chip: "bg-success text-success-foreground",
    text: "text-success",
  },
};

/** Order the cards sit in (lower first), so the most urgent leads whatever loads first. */
export type FollowOrder = number;

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

/**
 * One person (or one item) on a card. A plain string is just a name. An object can carry the photo address
 * (`avatarUrl`) and `gender` for the picture, a second line (`sub`: the department or the reason) and a bold
 * coloured `when` label on the right (a date, "อีก 2 วัน", "วันนี้"). `key` tells two items of the same person apart.
 */
export type FollowPerson =
  | string
  | { id?: string; key?: string; name: string; avatarUrl?: string | null; gender?: string | null; sub?: string; when?: string };

/**
 * The board the cards sit on: three equal-height cards in a row on a wide screen, two on a tablet, stacked on a
 * phone. `items-stretch` so the footer buttons line up at the bottom of the row.
 */
export const FOLLOW_BOARD_CLASS = "grid grid-cols-1 items-stretch gap-4 min-[860px]:grid-cols-2 xl:grid-cols-3";

/** Flat card: thin border, 8px radius, no shadow, no hover lift. */
const CARD = "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card";

/** Full-width 44px button used at the foot of every card. */
const BTN =
  "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border px-4 text-[14px] leading-[1.5] font-semibold transition-colors";
const BTN_PRIMARY = "border-primary bg-primary text-primary-foreground hover:brightness-110";
const BTN_OUTLINE = "border-primary bg-card text-[#0d47a1] hover:bg-accent dark:text-primary";

/** The 40px solid square that holds the card's icon. */
function Tile({ icon: Icon, tone }: { icon: IconType; tone: FollowTone }) {
  return (
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE[tone].tile)}>
      <Icon className="size-[22px]" aria-hidden="true" />
    </span>
  );
}

/**
 * One card on the "ต้องตามวันนี้" board (owner-approved mock, 26 Nov 2026): a solid icon tile, title and
 * one-line subtitle with the count (36px, unit under it) at the right, a solid status chip, EVERY person as a
 * row (picture, name, department or reason, bold when-label) and one full-width button at the bottom. A card
 * with nothing to follow is not drawn; the news ticker lists it as "ไม่มีวันนี้". Server- and client-safe (no hooks).
 *
 * The footer is the page to act on (`link`). A card with no page of its own (`link` left out) turns `children`
 * into the footer button instead (it opens the full detail in place, native `<details>`, works without JavaScript).
 * When a card has both, `children` stays reachable through a quiet "ดูรายละเอียดเพิ่มเติม" row above the button.
 */
export function FollowRow({
  icon,
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
  detailsLabel = "ดูรายละเอียด",
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
  /** The full detail: groups, extra buttons, notes. */
  children?: ReactNode;
  link?: { href: string; label: string };
  /** Number to show instead of `count` (e.g. "46.5"); the count still decides the tone. */
  display?: string;
  /** Everyone behind the count, one row each (not cut off). See {@link FollowPerson}. */
  people?: FollowPerson[];
  /** Show `children` right on the card instead of behind a button (short lists). */
  open?: boolean;
  /** Label of the footer button when the card has no `link` and opens `children` instead. */
  detailsLabel?: string;
}) {
  if (count <= 0) {
    // Not drawn: the news ticker on the hero reads this and says "ไม่มีวันนี้: …" once for all of them.
    return <span hidden data-follow-clear={title} />;
  }

  // One row per item: two items of the same person (two days) stay apart when they carry a reason or date;
  // plain names are merged (the first photo wins).
  const rowMap = new Map<string, { name: string; photo: string | null; gender: string | null; seed: string; sub?: string; when?: string }>();
  for (const p of people) {
    const o = typeof p === "string" ? { name: p } : p;
    const photo = ("avatarUrl" in o ? o.avatarUrl : null) ?? null;
    const gender = ("gender" in o ? o.gender : null) ?? null;
    const seed = ("id" in o ? o.id : undefined) ?? o.name;
    const sub = "sub" in o ? o.sub : undefined;
    const when = "when" in o ? o.when : undefined;
    const key = ("key" in o ? o.key : undefined) ?? `${o.name}|${sub ?? ""}|${when ?? ""}`;
    const have = rowMap.get(key);
    if (!have) rowMap.set(key, { name: o.name, photo, gender, seed, sub, when });
    else if (!have.photo && photo) have.photo = photo;
  }
  const rows = [...rowMap.values()];
  const names = [...new Set(rows.map((r) => r.name))];
  const t = TONE[tone];
  const primary = tone !== "info";
  const btn = cn(BTN, primary ? BTN_PRIMARY : BTN_OUTLINE);

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
      aria-label={`${title} ${display ?? count} ${unit}`}
      className={CARD}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-2.5">
        <Tile icon={icon} tone={tone} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] leading-[1.4] font-bold text-foreground">{title}</span>
          {sub && <span className="block text-[13px] leading-[1.5] text-muted-foreground">{sub}</span>}
        </span>
        <span className="shrink-0 text-right">
          <span className={cn("block text-[36px] leading-[1.1] font-bold tabular-nums", t.text)}>{display ?? count}</span>
          <span className="block text-[13px] leading-[1.5] text-muted-foreground">{unit}</span>
        </span>
      </div>
      {tag && (
        <span className={cn("mx-4 mb-2 inline-flex items-center gap-1.5 self-start rounded-md px-2.5 py-0.5 text-[13px] leading-[1.5] font-bold", t.chip)}>
          <span aria-hidden="true">{tone === "info" ? "i" : "!"}</span>
          {tag}
        </span>
      )}
      {rows.length > 0 && (
        <ul className="px-4">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2.5 border-t border-border py-2.5">
              <PersonAvatar name={r.name} gender={r.gender} seed={r.seed} src={r.photo} className="size-[34px] border border-border text-sm font-bold" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-[1.5] font-semibold break-words text-foreground">{r.name}</span>
                {r.sub && <span className="block text-[13px] leading-[1.5] break-words text-muted-foreground">{r.sub}</span>}
              </span>
              {r.when && <span className={cn("shrink-0 text-right text-[13px] leading-[1.5] font-bold tabular-nums", t.text)}>{r.when}</span>}
            </li>
          ))}
        </ul>
      )}
      {children && open && <div className="px-4 pt-1">{children}</div>}

      {/* Footer: one 44px button, pinned to the bottom so the buttons of a row line up. */}
      {link ? (
        <div className="mt-auto flex flex-col px-4 pt-3 pb-4">
          {children && !open && (
            <details className="group mb-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[14px] leading-[1.5] font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                ดูรายละเอียดเพิ่มเติม
                <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="space-y-2 pt-1 pb-2">{children}</div>
            </details>
          )}
          <Link href={link.href} className={btn}>
            {link.label}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        children &&
        !open && (
          <details className="group mt-auto px-4 pt-3 pb-4">
            <summary className={cn(btn, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              {detailsLabel}
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="space-y-2 pt-3">{children}</div>
          </details>
        )
      )}
      {!link && !(children && !open) && <div className="pb-2" />}
    </article>
  );
}

/** A card that failed to load, in the same slot so the board keeps its shape. */
export function FollowRowFailed({ icon, title, what, order }: { icon: IconType; title: string; what: string; order: FollowOrder }) {
  const Icon = icon;
  return (
    <div style={{ order }} className={cn(CARD, "p-4")}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-[22px]" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] leading-[1.4] font-bold text-foreground">{title}</span>
          <span className="block text-[13px] leading-[1.5] text-muted-foreground">โหลด{what}ไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</span>
        </span>
      </div>
    </div>
  );
}

/** Placeholder card while a slow card loads: same shape as a real card (header, chip, three rows, button). */
export function FollowRowLoading({ order }: { order: FollowOrder }) {
  const bar = "animate-pulse rounded bg-muted motion-reduce:animate-none";
  return (
    <div style={{ order }} aria-hidden="true" className={cn(CARD, "min-h-[260px]")}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-2.5">
        <span className={cn("size-10 shrink-0 rounded-lg", bar)} />
        <span className="flex flex-1 flex-col gap-2 pt-1">
          <span className={cn("h-4 w-32", bar)} />
          <span className={cn("h-3.5 w-44", bar)} />
        </span>
        <span className={cn("h-9 w-10", bar)} />
      </div>
      <ul className="px-4">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-2.5 border-t border-border py-2.5">
            <span className={cn("size-[34px] shrink-0 rounded-full", bar)} />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className={cn("h-3.5 w-28", bar)} />
              <span className={cn("h-3 w-20", bar)} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto px-4 pt-3 pb-4">
        <span className={cn("block h-11 w-full rounded-lg", bar)} />
      </div>
    </div>
  );
}
