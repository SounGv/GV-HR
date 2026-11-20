"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown, LogOut, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_GROUPS, type NavItem } from "@/config/navigation";
import { bestMatchHref } from "@/config/section-tabs";
import { useNavBadges } from "./use-nav-badges";
import { useAuth } from "@/features/auth/auth-context";
import { useAiAccess } from "@/features/ai/hooks";
import { useAiPanel } from "@/features/ai/ai-panel-context";
import { ApiError } from "@/lib/api/client";
import { useMenuPrefs } from "@/features/menu-prefs/hooks";
import { SidebarEditor } from "@/features/menu-prefs/sidebar-editor";
import { EMPTY_MENU_PREFS, isDefaultMenuPrefs, isHidden, orderMenu, type MenuPrefs } from "@/features/menu-prefs/rules";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";
import { NavIcon } from "@/components/shared/nav-icon";


export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, logout } = useAuth();
  const { data: aiAccess } = useAiAccess();
  const { toggle: toggleAiPanel, open: aiPanelOpen } = useAiPanel();

  // A grant-only user (see src/lib/ai/scope.ts) has no ai:* key in their JWT
  // claims, so the plain permission filter below would hide "AI Assistant"
  // for them even though the API would let them through.
  const canSee = (permission: string) =>
    can(permission) || (permission === "ai:read" && !!aiAccess?.data.allowed);

  // Live counts beside menu entries (shared with the tab row on every page).
  const badgeValue = useNavBadges();

  // Two sibling nav items can share a URL prefix without one being a detail
  // page of the other — e.g. "/attendance" (เข้างาน/ออกงาน) and
  // "/attendance/corrections" (แก้ไขเวลาเข้า-ออกงาน) are two different
  // features, but a plain per-item `startsWith` check marks BOTH active
  // while on /attendance/corrections (it starts with "/attendance/" too),
  // highlighting two menu items at once. Several other items point at a
  // query-string *view* on a shared page (e.g. "/reports?view=leave" vs
  // "/reports?view=attendance") — a path-only match can't tell those apart
  // at all, and previously ignored every href with "?" entirely, so none of
  // them ever highlighted. Score every href on path length (a longer, more
  // specific path always outranks a shorter one it starts with) plus one
  // point per query key that's present with an equal value in the current
  // URL — a href whose query doesn't match the current one is excluded
  // outright, so "/reports" bare only wins when no "view" is selected at all.
  const bestMatch = bestMatchHref(
    pathname,
    searchParams,
    NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
  );
  const isActive = (href: string) => href === bestMatch;
  const groupHasActive = (labels: { href: string }[]) => labels.some((i) => isActive(i.href));

  // Collapsible groups: open the group containing the current route by default.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) init[g.label] = groupHasActive(g.items);
    return init;
  });
  const toggle = (label: string) => setOpen((s) => ({ ...s, [label]: !s[label] }));

  // Going to another page leaves only the group that page belongs to open, so
  // groups opened earlier fold away by themselves. Groups opened by hand stay
  // open until the next page change. A page outside every group changes nothing.
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) => groupHasActive(g.items));
    if (!activeGroup) return;
    setOpen({ [activeGroup.label]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  // This person's own layout (saved on their account): order, hidden and pinned items.
  const { prefs, save, reset } = useMenuPrefs();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MenuPrefs>(EMPTY_MENU_PREFS);

  // Featured items (AI Assistant) sit on their own above the groups, so they never appear inside one.
  const showAi = NAV_GROUPS.some((g) => g.items.some((i) => i.featured && i.opensAiPanel && canSee(i.permission)));
  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.featured && canSee(i.permission)) })).filter(
    (g) => g.items.length > 0,
  );
  const ordered = orderMenu(visibleGroups, editing ? draft : prefs);

  function startEditing() {
    setDraft(prefs);
    setEditing(true);
  }

  async function finishEditing() {
    try {
      // A layout that changes nothing is stored as "no layout" (the default menu).
      if (isDefaultMenuPrefs(draft)) await reset.mutateAsync();
      else await save.mutateAsync(draft);
      setEditing(false);
      toast.success("บันทึกเมนูของคุณแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกเมนูไม่สำเร็จ");
    }
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const href = item.ready ? item.href : `/coming-soon?title=${encodeURIComponent(item.label)}`;
    const badge = item.badgeKey ? badgeValue(item.badgeKey) : 0;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={active}
          tooltip={item.label}
          className={cn(
            "h-10 text-[14px] [&_svg]:size-4",
            active
              ? "data-active:bg-[#e3f2fd] data-active:font-bold data-active:text-[#0d47a1] data-active:shadow-[inset_3px_0_0_#1976d2] data-active:hover:bg-[#e3f2fd] data-active:hover:text-[#0d47a1] dark:data-active:bg-[#0f2744] dark:data-active:text-[#90caf9] dark:data-active:hover:bg-[#0f2744]"
              : "font-medium text-sidebar-foreground hover:text-sidebar-foreground",
          )}
          render={
            item.isLogout ? (
              <button type="button" onClick={() => logout()} />
            ) : item.opensAiPanel ? (
              <button type="button" onClick={toggleAiPanel} />
            ) : (
              <Link href={href} />
            )
          }
        >
          <span className="flex items-center gap-2">
            <NavIcon href={item.href} />
            {prefs.pinned.includes(item.href) && (
              // A starred item sits first in its group; the small star says why.
              <Star className={cn("size-3! shrink-0", !active && "text-sidebar-primary")} fill="currentColor" aria-label="ปักหมุดไว้" />
            )}
            {item.label}
          </span>
        </SidebarMenuButton>
        {!item.ready && <SidebarMenuBadge className="text-xs text-muted-foreground">เร็วๆ นี้</SidebarMenuBadge>}
        {item.ready && badge > 0 && (
          <SidebarMenuBadge className="bg-[var(--badge)] font-semibold text-white">{badge > 9 ? "9+" : badge}</SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="justify-center overflow-hidden px-4 pt-5 pb-2 group-data-[collapsible=icon]:h-16 group-data-[collapsible=icon]:py-3">
        <Link href="/dashboard" aria-label="GV One">
          {/* Import kept inline to avoid a client/server import cycle warning */}
          <NexaHeaderLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0.5">
        {!editing && showAi && <AiShortcut active={aiPanelOpen || pathname === "/ai"} onClick={toggleAiPanel} />}
        {editing ? (
          <SidebarEditor
            groups={ordered}
            draft={draft}
            onChange={setDraft}
            onDone={finishEditing}
            onCancel={() => setEditing(false)}
            onReset={() => setDraft({ ...EMPTY_MENU_PREFS, itemOrder: {} })}
            saving={save.isPending || reset.isPending}
          />
        ) : (
          <>
            {ordered.map((group) => {
              const items = group.items.filter((item) => !isHidden(prefs, item.href));
              if (items.length === 0) return null;

              const expanded = open[group.label] ?? false;
              return (
                <SidebarGroup key={group.label} className="py-0.5">
                  <button
                    type="button"
                    onClick={() => toggle(group.label)}
                    aria-expanded={expanded}
                    className={cn("flex h-11 w-full items-center gap-3 rounded-md px-3 text-[15px] font-bold text-sidebar-foreground transition-colors hover:bg-sidebar-accent", expanded && "bg-primary/20 text-sidebar-foreground")}
                  >
                    <span className="flex-grow text-left">{group.label}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-[color:var(--muted-strong)] transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <SidebarGroupContent className="mt-0.5 mb-1.5 ml-6 w-auto border-l-2 border-sidebar-border pl-3">
                      <SidebarMenu>
                        {items.map((item, i) => {
                          // A small heading where the section changes (the settings group); a group without sections shows none.
                          const heading = item.section && item.section !== items[i - 1]?.section ? item.section : null;
                          return (
                            <Fragment key={item.href}>
                              {heading && <li className="px-2 pt-2.5 pb-0.5 text-xs font-bold text-[color:var(--muted-strong)]">{heading}</li>}
                              {renderItem(item)}
                            </Fragment>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              );
            })}
          </>
        )}
      </SidebarContent>

      {!editing && (
        <SidebarFooter className="gap-2 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={startEditing}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#cfd6dc] text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground dark:border-sidebar-border"
          >
            <ArrowUpDown className="size-4" />
            จัดเรียงเมนู
          </button>
          {/* Sign out is pinned here, apart from the settings pages, so it is always in the same place and hard to hit by mistake. */}
          <button
            type="button"
            onClick={() => logout()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[13.5px] font-semibold text-[color:var(--muted-strong)] transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
          >
            <LogOut className="size-4" aria-hidden="true" />
            ออกจากระบบ
          </button>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

/**
 * AI Assistant on its own, right under the brand: a soft mint card with
 * น้องวีบอท, so it is the easiest thing in the menu to reach. Opens the
 * floating AI panel (like the old menu item did); collapsed to icon width it
 * is น้องวีบอท alone.
 */
function AiShortcut({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div className="px-3 pt-1 pb-2 group-data-[collapsible=icon]:px-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label="เปิดน้องวีบอท"
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-md border border-[#bbdefb] bg-[#eef6fd] p-2 pr-3 text-left",
          "transition-colors",
          "hover:border-[#90caf9] focus-visible:ring-3 focus-visible:ring-[#1976d2]/30 focus-visible:outline-none motion-reduce:transition-none",
          "dark:border-sidebar-border dark:bg-none dark:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1",
          active && "border-[#1976d2] ring-2 ring-[#1976d2]/20",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-[inset_0_0_0_1px_#e3f2fd] group-data-[collapsible=icon]:size-8 dark:bg-background">
          <VBot mood="hi" className="ai-shortcut-bot gv-wave size-8 group-data-[collapsible=icon]:size-6" />
          <Sparkles className="ai-shortcut-spark size-6 text-[#1976d2] group-data-[collapsible=icon]:size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-snug group-data-[collapsible=icon]:hidden">
          <b className="block text-[14px] font-bold text-[#0d47a1] dark:text-foreground">น้องวีบอท</b>
          <span className="block truncate text-xs text-muted-foreground">ถามได้ทุกเรื่องงาน HR</span>
        </span>
        <Sparkles className="size-4 shrink-0 text-[#1976d2] group-data-[collapsible=icon]:hidden" aria-hidden="true" />
      </button>
    </div>
  );
}

const BRAND_DAY = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
const BRAND_TIME = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" });

/** Ticks every 30 s; null until mounted so the server and browser never disagree on the time. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

/**
 * Sidebar brand, "ลายเซ็น" (sidebar-brand-mock.html, option A): no box —
 * the real GV mark large with the wordmark and a lime HR tag, a soft teal
 * light pooling behind it, and a live "today" line under a hairline.
 * น้องวีบอท lives on the AI Assistant shortcut right below (one place only).
 * Collapsed to icon width it is the mark alone.
 */
function NexaHeaderLogo() {
  const now = useNow();
  return (
    <div className="flex w-full items-center justify-center">
      {/* Icon-only mark when the sidebar is collapsed to icon width */}
      <Logo size={40} className="hidden size-10 group-data-[collapsible=icon]:block" />

      <div className="relative hidden w-full flex-col group-data-[collapsible=icon]:hidden md:flex">
        <span className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <span className="gv-live" aria-hidden="true" />
          <span>
            วันนี้ <b className="font-semibold text-foreground tabular-nums">{now ? BRAND_DAY.format(now) : "—"}</b>
          </span>
          <b className="ml-auto font-semibold text-foreground tabular-nums">{now ? BRAND_TIME.format(now) : ""}</b>
        </span>
      </div>
    </div>
  );
}
