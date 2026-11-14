"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Megaphone,
  Pause,
  Play,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { VBot } from "@/components/shared/v-bot";
import { cn } from "@/lib/utils";

type Tone = "bad" | "warn" | "info" | "ok";

interface Item {
  key: string;
  tone: Tone;
  icon: LucideIcon;
  word: string;
  detail: string;
  href: string;
}

const RANK: Record<Tone, number> = { bad: 0, warn: 1, info: 2, ok: 3 };

/** Pill colours: solid fill with white text (dark text on yellow); the icon sits in a white circle in the same colour. */
const PILL: Record<Tone, { pill: string; icon: string }> = {
  bad: { pill: "bg-[var(--ticker-bad)] text-white", icon: "text-[var(--ticker-bad)]" },
  warn: { pill: "bg-[var(--ticker-warn)] text-[var(--ticker-warn-fg)]", icon: "text-[#92400e]" },
  info: { pill: "bg-[var(--ticker-info)] text-white", icon: "text-[var(--ticker-info)]" },
  ok: { pill: "bg-[var(--ticker-ok)] text-white", icon: "text-[var(--ticker-ok)]" },
};

function iconFor(title: string): LucideIcon {
  if (/ขาด|ลืม/.test(title)) return TriangleAlert;
  if (/อนุมัติ|ประเมิน/.test(title)) return ClipboardCheck;
  if (/ลา|ประชุม/.test(title)) return Users;
  if (/สาย|OT|ทดลอง|ครบ/.test(title)) return Clock;
  return TriangleAlert;
}

/** Reads the "ต้องตามวันนี้" board (its cards stream in one by one, like FollowCount) and turns it into messages. */
function readBoard(board: HTMLElement, announcement: { id: string; title: string } | null): Item[] {
  const items: Item[] = [];
  board.querySelectorAll<HTMLElement>("[data-follow-card]").forEach((el, n) => {
    const d = el.dataset;
    const title = d.followTitle ?? "";
    const tone = (d.followTone as Tone) ?? "info";
    const names = d.followNames ? ` (${d.followNames})` : "";
    items.push({
      key: `card-${n}-${title}`,
      tone,
      icon: iconFor(title),
      word: d.followTag || (tone === "bad" ? "ต้องทำ" : tone === "warn" ? "ควรดู" : "แจ้งให้ทราบ"),
      detail: `${title} ${d.followCount ?? ""} ${d.followUnit ?? ""}${names}`.replace(/\s+/g, " ").trim(),
      href: d.followHref || "#follow-up",
    });
  });
  items.sort((a, b) => RANK[a.tone] - RANK[b.tone]);
  if (announcement) {
    items.push({ key: `ann-${announcement.id}`, tone: "info", icon: Megaphone, word: "ประกาศ", detail: announcement.title, href: `/announcements/${announcement.id}` });
  }
  const clears = [...board.querySelectorAll<HTMLElement>("[data-follow-clear]")].map((el) => el.dataset.followClear ?? "").filter(Boolean);
  if (clears.length > 0) {
    items.push({ key: "clear", tone: "ok", icon: Check, word: "ไม่มีวันนี้", detail: clears.join(", "), href: "#follow-up" });
  }
  return items;
}

/**
 * The strip on the attendance hero (owner-approved mock, 14 Nov 2026): one message at
 * a time walks in slowly from the right behind น้องวีบอท, rests for five seconds, and
 * walks out to the left. Red = to do today, yellow = coming due, blue = announcements
 * and leave, green = nothing pending. Every message has an icon and a word, so colour
 * is never the only signal. Hover, keyboard focus or the pause button stops it; with
 * "reduce motion" on it does not move, it only swaps the message every six seconds.
 * The full list is also in the page for screen readers.
 */
export function NewsTicker({ announcement }: { announcement: { id: string; title: string } | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const applyPause = useRef<(() => void) | null>(null);
  const announcementKey = announcement ? `${announcement.id}:${announcement.title}` : "";

  // Follow the board as its cards arrive and as the live rows refresh.
  useEffect(() => {
    const board = document.getElementById("follow-up");
    if (!board) return;
    let last = "";
    const read = () => {
      const next = readBoard(board, announcement);
      const sig = JSON.stringify(next.map((i) => [i.key, i.word, i.detail]));
      if (sig === last) return;
      last = sig;
      setItems(next);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-follow-count"] });
    return () => obs.disconnect();
    // announcement is read through announcementKey so a new object with the same text does not restart the watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementKey]);

  const len = items.length;
  const current = len > 0 ? items[idx % len] : null;
  const botHere = len > 0;

  // One น้องวีบอท per screen: the sidebar card swaps to a sparkle while this one is on the page.
  useEffect(() => {
    if (!botHere) return;
    document.body.dataset.tickerBot = "1";
    return () => {
      delete document.body.dataset.tickerBot;
    };
  }, [botHere]);

  useEffect(() => {
    pausedRef.current = userPaused || hovered;
    applyPause.current?.();
  }, [userPaused, hovered]);

  // Walk in, rest, walk out, then the next message.
  useEffect(() => {
    const el = itemRef.current;
    const stage = stageRef.current;
    if (!el || !stage || len === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = stage.clientWidth;
    const mid = Math.max(0, (width - el.offsetWidth) / 2);
    let dead = false;
    let anim: Animation | null = null;
    let timer: number | undefined;
    let phase: "in" | "rest" | "out" = "in";
    let left = 0;
    let startedAt = 0;
    const next = () => {
      if (!dead) setIdx((i) => i + 1);
    };
    const exit = () => {
      timer = undefined;
      if (reduce) return next();
      phase = "out";
      delete el.dataset.stand;
      anim = el.animate(
        [{ transform: `translate(${mid}px,-50%)` }, { transform: `translate(${-el.offsetWidth - 20}px,-50%)` }],
        { duration: 2600, easing: "ease-in", fill: "forwards" },
      );
      anim.onfinish = next;
      if (pausedRef.current) anim.pause();
    };
    const rest = (ms: number) => {
      phase = "rest";
      el.dataset.stand = "1";
      left = ms;
      startedAt = Date.now();
      if (!pausedRef.current) timer = window.setTimeout(exit, ms);
    };
    if (reduce) {
      el.style.transform = `translate(${mid}px,-50%)`;
      rest(6000);
    } else {
      anim = el.animate(
        [{ transform: `translate(${width}px,-50%)` }, { transform: `translate(${mid}px,-50%)` }],
        { duration: 3200, easing: "ease-out", fill: "forwards" },
      );
      anim.onfinish = () => rest(5000);
      if (pausedRef.current) anim.pause();
    }
    applyPause.current = () => {
      if (pausedRef.current) {
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
          left = Math.max(500, left - (Date.now() - startedAt));
        }
        if (anim && anim.playState === "running") anim.pause();
      } else {
        if (anim && anim.playState === "paused") anim.play();
        if (phase === "rest" && timer === undefined) {
          startedAt = Date.now();
          timer = window.setTimeout(exit, left);
        }
      }
    };
    return () => {
      dead = true;
      if (timer !== undefined) window.clearTimeout(timer);
      anim?.cancel();
      applyPause.current = null;
    };
  }, [idx, len, current?.key]);

  const go = (delta: number) => setIdx((i) => (len === 0 ? 0 : (i + delta + len * 1000) % len));
  const paused = userPaused || hovered;

  return (
    <div
      role="region"
      aria-label="ข่าวสารวันนี้"
      data-paused={paused ? "" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="ticker flex min-h-16 items-center gap-2 rounded-2xl bg-black/20 pr-1.5 pl-2.5"
    >
      <div ref={stageRef} className="relative h-16 min-w-0 flex-1 overflow-hidden" aria-hidden={len > 0 ? "true" : undefined}>
        {current && (
          <div
            key={`${idx}-${current.key}`}
            ref={itemRef}
            className="ticker-item absolute top-1/2 left-0 flex max-w-[calc(100%-4px)] items-center gap-3 will-change-transform"
            style={{ transform: "translate(110%,-50%)" }}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)]">
              <VBot mood="hi" className="ticker-walk size-9" />
            </span>
            <Link
              href={current.href}
              tabIndex={-1}
              className={cn(
                "inline-flex min-h-12 min-w-0 items-center gap-3 rounded-full border-2 border-white/55 py-1 pr-5 pl-[7px] text-base leading-snug shadow-[0_3px_10px_rgba(0,0,0,.22)]",
                PILL[current.tone].pill,
                current.tone === "bad" && "ticker-pulse-on",
              )}
            >
              <span className={cn("flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white", PILL[current.tone].icon)}>
                <current.icon className="size-5" strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="font-bold">{current.word}</span>
              <span aria-hidden="true" className="hidden h-[22px] w-0.5 shrink-0 rounded-sm bg-current opacity-40 sm:block" />
              <span className="min-w-0 font-medium">{current.detail}</span>
            </Link>
          </div>
        )}
      </div>
      {len > 0 && (
        <>
          {/* Screen readers get every message at once instead of the moving one. */}
          <ul className="sr-only">
            {items.map((i) => (
              <li key={i.key}>
                <Link href={i.href}>
                  {i.word}: {i.detail}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 items-center gap-1.5 text-white">
            <span className="hidden min-w-9 text-center text-xs tabular-nums text-white/85 xl:block">
              {(idx % len) + 1}/{len}
            </span>
            <TickerButton label="ข้อความก่อนหน้า" onClick={() => go(-1)} className="hidden xl:inline-flex">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </TickerButton>
            <TickerButton label={userPaused ? "เล่นต่อ" : "หยุดชั่วคราว"} onClick={() => setUserPaused((p) => !p)}>
              {userPaused ? <Play className="size-5" aria-hidden="true" /> : <Pause className="size-5" aria-hidden="true" />}
            </TickerButton>
            <TickerButton label="ข้อความถัดไป" onClick={() => go(1)} className="hidden xl:inline-flex">
              <ChevronRight className="size-5" aria-hidden="true" />
            </TickerButton>
          </div>
        </>
      )}
    </div>
  );
}

function TickerButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
