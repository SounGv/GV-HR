"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown, Sparkles, Star } from "lucide-react";
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
import { useAuth } from "@/features/auth/auth-context";
import { useAiAccess } from "@/features/ai/hooks";
import { useAiPanel } from "@/features/ai/ai-panel-context";
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections } from "@/features/attendance-correction/hooks";
import { useMyPendingAppraisalTasks } from "@/features/appraisal-round/hooks";
import { useNotifications } from "@/features/notification/hooks";
import { ApiError } from "@/lib/api/client";
import { useMenuPrefs } from "@/features/menu-prefs/hooks";
import { SidebarEditor } from "@/features/menu-prefs/sidebar-editor";
import { EMPTY_MENU_PREFS, isDefaultMenuPrefs, isHidden, orderMenu, type MenuPrefs } from "@/features/menu-prefs/rules";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";


export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, canAny, logout } = useAuth();
  const { data: aiAccess } = useAiAccess();
  const { toggle: toggleAiPanel, open: aiPanelOpen } = useAiPanel();

  // A grant-only user (see src/lib/ai/scope.ts) has no ai:* key in their JWT
  // claims, so the plain permission filter below would hide "AI Assistant"
  // for them even though the API would let them through.
  const canSee = (permission: string) =>
    can(permission) || (permission === "ai:read" && !!aiAccess?.data.allowed);

  // Live sidebar badges — same data sources already powering the mobile
  // bottom nav's badges, just surfaced here too (a first for desktop).
  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);
  const correctionPendingQ = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
  const pendingApprovals =
    (leavePendingQ.data?.data.length ?? 0) +
    (otPendingQ.data?.data.length ?? 0) +
    (correctionPendingQ.data?.data.length ?? 0);

  const pendingReviews = useMyPendingAppraisalTasks().items.length;

  const notificationsQ = useNotifications();
  const unreadNotifications = notificationsQ.data?.data.unread ?? 0;

  const badgeValue = (key: NavItem["badgeKey"]): number => {
    if (key === "pendingApprovals") return pendingApprovals;
    if (key === "pendingReviews") return pendingReviews;
    if (key === "unreadNotifications") return unreadNotifications;
    return 0;
  };

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
  const allHrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  const bestMatch = allHrefs
    .map((href) => {
      const url = new URL(href, "http://x");
      const path = url.pathname;
      const query = [...url.searchParams.entries()];
      const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
      const queryMatches = query.every(([key, value]) => searchParams.get(key) === value);
      if (!pathMatches || !queryMatches) return null;
      return { href, score: path.length * 10 + query.length };
    })
    .filter((m): m is { href: string; score: number } => m !== null)
    .sort((a, b) => b.score - a.score)[0]?.href;
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
            "h-9 text-[14px] [&_svg]:size-4",
            active
              ? "data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground data-active:shadow-[0_1px_2px_rgba(15,118,110,.2),0_6px_14px_-8px_rgba(15,118,110,.5)] data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground"
              : "text-sidebar-foreground/85 hover:text-sidebar-foreground",
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
          <span className="flex items-center gap-1.5">
            {prefs.pinned.includes(item.href) && (
              // A starred item sits first in its group; the small star says why.
              <Star className={cn("size-3! shrink-0", !active && "text-sidebar-primary")} fill="currentColor" aria-label="ปักหมุดไว้" />
            )}
            {item.label}
          </span>
        </SidebarMenuButton>
        {!item.ready && <SidebarMenuBadge className="text-[10px] text-muted-foreground">เร็วๆ นี้</SidebarMenuBadge>}
        {item.ready && badge > 0 && (
          <SidebarMenuBadge className="bg-[#CDEB03] font-semibold text-[#131516]">{badge > 9 ? "9+" : badge}</SidebarMenuBadge>
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
                    className="flex h-11 w-full items-center gap-3 rounded-xl px-2.5 text-[14.5px] font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
                  >
                    {/* The open group's icon fills teal so you can see where you are at a glance. */}
                    <span
                      className={cn(
                        "flex size-[30px] shrink-0 items-center justify-center rounded-[9px] transition-colors",
                        expanded
                          ? "bg-[linear-gradient(150deg,#115e59,#0f766e_55%,#0d9488)] text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_4px_10px_-6px_rgba(15,118,110,.5)]"
                          : "border border-sidebar-border bg-card text-[#0f766e] shadow-[0_1px_2px_rgba(19,21,22,.06)] dark:text-[#2dd4bf]",
                      )}
                    >
                      <group.icon className="size-[17px]" strokeWidth={2.2} />
                    </span>
                    <span className="flex-grow text-left">{group.label}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                  </button>
                  {expanded && (
                    <SidebarGroupContent className="mt-0.5 mb-1.5 ml-6 w-auto border-l-2 border-sidebar-border pl-3">
                      <SidebarMenu>{items.map(renderItem)}</SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              );
            })}
          </>
        )}
      </SidebarContent>

      {!editing && (
        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={startEditing}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#cfd6dc] text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground dark:border-sidebar-border"
          >
            <ArrowUpDown className="size-4" />
            จัดเรียงเมนู
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
        aria-label="เปิด AI Assistant"
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-2xl border border-[#99f6e4] bg-[linear-gradient(135deg,#f0fdfa,#ecfeff_60%,#f7fee7)] p-2 pr-3 text-left",
          "shadow-[0_1px_2px_rgba(15,118,110,0.08),0_8px_18px_-12px_rgba(15,118,110,0.45)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "hover:-translate-y-px hover:border-[#5eead4] hover:shadow-[0_1px_2px_rgba(15,118,110,0.1),0_12px_24px_-12px_rgba(15,118,110,0.55)] focus-visible:ring-3 focus-visible:ring-[#0d9488]/30 focus-visible:outline-none motion-reduce:transition-none",
          "dark:border-sidebar-border dark:bg-none dark:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1",
          active && "border-[#0d9488] ring-2 ring-[#0d9488]/20",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_#ccfbf1] group-data-[collapsible=icon]:size-8 dark:bg-background">
          <VBot mood="hi" className="gv-wave size-8 group-data-[collapsible=icon]:size-6" />
        </span>
        <span className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
          <b className="block text-[14px] font-bold text-[#115e59] dark:text-foreground">AI Assistant</b>
          <span className="block truncate text-[11.5px] text-muted-foreground">ถามน้องวีบอทได้เลย</span>
        </span>
        <Sparkles className="size-4 shrink-0 text-[#0d9488] group-data-[collapsible=icon]:hidden" aria-hidden="true" />
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[120px] -left-[110px] h-[260px] w-[330px] rounded-full bg-[radial-gradient(closest-side,rgba(13,148,136,0.16),rgba(13,148,136,0))]"
        />
        <div className="group/brand relative flex items-center gap-2.5">
          <Logo
            size={56}
            className="h-auto w-14 drop-shadow-[0_6px_10px_rgba(19,21,22,0.18)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/brand:-translate-y-0.5 group-hover/brand:-rotate-3 motion-reduce:transition-none"
          />
          <span className="min-w-0 leading-tight">
            <b className="flex items-center gap-1.5 text-[20px] leading-[1.15] font-bold tracking-[-0.02em] whitespace-nowrap text-foreground">
              GV One
              <span className="rounded-[5px] bg-[#CDEB03] px-1.5 py-px text-[10.5px] leading-[1.4] font-bold tracking-[0.02em] text-[#131516] shadow-[0_2px_6px_-2px_rgba(132,152,0,0.6)]">
                HR
              </span>
            </b>
            <span className="mt-0.5 block text-xs text-muted-foreground">Gadget Villa</span>
          </span>
        </div>
        <span className="relative mt-3 flex items-center gap-2 border-t border-[#eef1f3] pt-2.5 text-xs text-muted-foreground dark:border-sidebar-border">
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
