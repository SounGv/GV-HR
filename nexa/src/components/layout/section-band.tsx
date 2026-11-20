"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { previousOf, readTrail } from "@/components/mobile/nav-trail";
import { NAV_GROUPS } from "@/config/navigation";
import { resolveSection } from "@/config/section-tabs";
import { useAuth } from "@/features/auth/auth-context";
import { useAiAccess } from "@/features/ai/hooks";
import { cn } from "@/lib/utils";
import { HOME_PATH } from "./app-shell-nav";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { useNavBadges } from "./use-nav-badges";
import { usePublishedChrome, useSlotSetter } from "./page-chrome";

type BandCrumb = { label: React.ReactNode; href?: string };

/**
 * The band at the top of every page on a computer, one sticky layer, in the Favpo look (approved mocks, 20 Nov 2026):
 *  Bar:   solid blue, 56px: side menu button, the GV One wordmark, then notifications, theme and account on the right.
 *  Row 1: back, where you are (group, then page title) and the page's buttons when the group has no tabs.
 *  Row 2: the tabs of this menu group (the sidebar's own entries for it) with the page's main button at the far right.
 * It replaces the old top bar (64px), the page title block (about 76px) and the separate tab rows, so the work area starts
 * about 100px higher and switching to a sibling page is one click. A group without siblings (home) has row 1 only and the
 * page's buttons sit in row 1 instead. A group with more than six tabs gets a row of section chips between rows 1 and 2, so
 * the tab row itself stays short (the band is then about 136px).
 */
export function SectionBand() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const { data: aiAccess } = useAiAccess();
  const badge = useNavBadges();
  const chrome = usePublishedChrome();
  const setSlot = useSlotSetter();
  const rootRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // A grant-only AI user has no ai:* key, same rule as the side menu.
  const canSee = useMemo(
    () => (permission: string) => can(permission) || (permission === "ai:read" && !!aiAccess?.data.allowed),
    [can, aiAccess?.data.allowed],
  );
  const section = useMemo(() => resolveSection(NAV_GROUPS, canSee, pathname, search), [canSee, pathname, search]);

  const isHome = pathname === HOME_PATH;
  const hasTabs = section.tabs.length > 0;
  const title = chrome?.title ?? section.title;
  const crumbs: BandCrumb[] =
    chrome?.crumbs && chrome.crumbs.length > 0
      ? chrome.crumbs
      : [...(section.group ? [{ label: section.group, href: section.tabs[0]?.href }] : []), ...(title ? [{ label: title }] : [])];

  // Publishes its height so a tab row inside the page can stick just below it (see stickyTabsRow).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty("--gv-band-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--gv-band-h");
    };
  }, []);

  // On a narrow window the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [section.activeHref]);

  return (
    <header ref={rootRef} className="print:hidden">
      <div className="gv-bar-blue flex h-14 items-center gap-2 bg-[#0d47a1] px-3 text-white sm:px-4 dark:bg-[#0a2f6b]">
        <SidebarTrigger className="-ml-1 size-11" />
        <Link href={HOME_PATH} aria-label="GV One หน้าหลัก" className="text-[22px] leading-none font-bold tracking-tight text-white hover:text-white">
          GV One
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NotificationBell />
          <ThemeToggle />
          <Separator orientation="vertical" className="mx-1 h-5 bg-white/30" />
          <UserMenu />
        </div>
      </div>
      {/* Favpo page head: a small path row, then one row with the back arrow on the left, the title in the middle and the page's
          buttons on the right (the slot below is where every page's buttons are drawn), the subtitle under the title. */}
      <nav aria-label="เส้นทางนำทาง" className="flex min-h-8 items-center gap-1 border-b border-border bg-card px-3 text-[13px] sm:px-4">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              {last ? (
                <span aria-current="page" className="truncate text-foreground">
                  {c.label}
                </span>
              ) : c.href ? (
                <Link href={c.href} className="truncate text-muted-foreground transition hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-muted-foreground">{c.label}</span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="grid min-h-14 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b border-border bg-card px-3 py-1 sm:px-4">
        <div className="flex items-center">
          {/* The one back control on a computer, on every page but home: back to the page the person came from, or home when this is
              where they started. */}
          {!isHome && (
            <button
              type="button"
              onClick={() => router.push(previousOf(readTrail()) ?? HOME_PATH)}
              aria-label="ย้อนกลับ"
              className="flex size-11 items-center justify-center rounded-lg text-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="flex min-w-0 items-center justify-center gap-2">
            {chrome?.leading && <span className="shrink-0">{chrome.leading}</span>}
            <h1 className="font-heading truncate text-xl leading-snug font-medium text-foreground">{title || "GV One"}</h1>
            {chrome?.status && <span className="shrink-0">{chrome.status}</span>}
          </div>
          {chrome?.subtitle && (
            <span className="max-w-full truncate text-sm text-muted-foreground" title={chrome.subtitle}>
              {chrome.subtitle}
            </span>
          )}
        </div>
        <div ref={setSlot ?? undefined} className="flex min-w-0 items-center justify-end gap-2" />
      </div>

      {/* A long tab row (the settings group, the evaluation group) is split: one chip per section here, the tabs of the open
          section in the row below. The chips follow the headings the side menu already has. */}
      {section.sections && (
        <nav aria-label={section.group ? `ส่วนของ ${section.group}` : "ส่วนของเมนู"} className="flex h-11 items-center gap-2 overflow-x-auto border-b border-border bg-card px-3 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {section.sections.map((c) => (
            <Link
              key={c.name}
              href={c.href}
              aria-current={c.active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                c.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-[color:var(--muted-strong)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {hasTabs && (
        <div className="flex h-12 items-stretch gap-3 border-b border-border bg-card px-3 sm:px-4">
          <nav aria-label={section.group ? `เมนูย่อย ${section.group}` : "เมนูย่อย"} className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {section.visibleTabs.map((t) => {
              const active = t.href === section.activeHref;
              const count = t.badgeKey ? badge(t.badgeKey) : 0;
              return (
                <Link
                  key={t.href}
                  ref={active ? activeRef : undefined}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                    active ? "text-primary" : "text-[color:var(--muted-strong)] hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {t.label}
                  {count > 0 && (
                    <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] leading-5 font-bold text-primary-foreground tabular-nums">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                  <span aria-hidden="true" className={cn("absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-primary transition-opacity", active ? "opacity-100" : "opacity-0")} />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
