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
 * The band at the top of every page on a computer: two rows, 92px, one sticky layer.
 *  Row 1: side menu button, where you are (group, then page title), notifications, theme, account.
 *  Row 2: the tabs of this menu group (the sidebar's own entries for it) with the page's main button at the far right.
 * It replaces the old top bar (64px), the page title block (about 76px) and the separate tab rows, so the work area starts
 * about 100px higher and switching to a sibling page is one click. A group without siblings (home) has row 1 only and the
 * page's buttons sit in row 1 instead.
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
    <header ref={rootRef} className="border-b border-border bg-card print:hidden">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <SidebarTrigger className="-ml-1 size-10" />
        {/* The one back control on a computer, on every page but home (as the old top bar had it): back to the page the person
            came from, or home when this is where they started. */}
        {!isHome && (
          <button
            type="button"
            onClick={() => router.push(previousOf(readTrail()) ?? HOME_PATH)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            ย้อนกลับ
          </button>
        )}
        {chrome?.leading && <span className="shrink-0">{chrome.leading}</span>}
        <nav aria-label="เส้นทางนำทาง" className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={i}>
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                {last ? (
                  <h1 className="font-heading truncate text-[15px] leading-normal font-bold text-foreground">{c.label}</h1>
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
          {/* A page without a title of its own yet (still loading) shows the menu's name; this keeps the heading a real h1. */}
          {crumbs.length === 0 && <h1 className="sr-only">GV One</h1>}
        </nav>
        {chrome?.subtitle && (
          <span className="hidden min-w-0 truncate border-l border-border pl-3 text-sm text-muted-foreground lg:inline" title={chrome.subtitle}>
            {chrome.subtitle}
          </span>
        )}
        {chrome?.status && <span className="shrink-0">{chrome.status}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          {!hasTabs && <div ref={setSlot ?? undefined} className="flex items-center gap-2 pr-2" />}
          <NotificationBell />
          <ThemeToggle />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <UserMenu />
        </div>
      </div>

      {hasTabs && (
        <div className="flex h-11 items-stretch gap-3 border-t border-border/60 px-3 sm:px-4">
          <nav aria-label={section.group ? `เมนูย่อย ${section.group}` : "เมนูย่อย"} className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {section.tabs.map((t) => {
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
          <div ref={setSlot ?? undefined} className="flex shrink-0 items-center gap-2 self-center pl-2" />
        </div>
      )}
    </header>
  );
}
