"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown, Star } from "lucide-react";
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


export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can, canAny, logout } = useAuth();
  const { data: aiAccess } = useAiAccess();
  const { toggle: toggleAiPanel } = useAiPanel();

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

  const visibleGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(i.permission)) })).filter(
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
      <SidebarHeader className="justify-center overflow-hidden px-4 py-3 group-data-[collapsible=icon]:h-16">
        <Link href="/dashboard" aria-label="GV One">
          {/* Import kept inline to avoid a client/server import cycle warning */}
          <NexaHeaderLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0.5">
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

function NexaHeaderLogo() {
  return (
    <div className="flex w-full items-center justify-center">
      {/* Icon-only mark when the sidebar is collapsed to icon width */}
      <Logo size={40} className="hidden size-10 group-data-[collapsible=icon]:block" />

      {/* Expanded: the brand sits on one teal card at the top of the white menu. */}
      <div className="hidden w-full items-center gap-2.5 rounded-2xl bg-[linear-gradient(150deg,#115e59,#0f766e_55%,#0d9488)] px-3 py-2.5 text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_6px_14px_-8px_rgba(15,118,110,.5),inset_0_1px_0_rgba(255,255,255,.14)] group-data-[collapsible=icon]:hidden md:flex">
        <Logo size={44} className="h-auto w-11" />
        <span className="min-w-0 leading-tight">
          <b className="block text-[15px] whitespace-nowrap">GV One</b>
          <span className="text-[11.5px] text-white/80">Gadget Villa</span>
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-[#CDEB03] px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-[#131516]">
          HR
        </span>
      </div>
    </div>
  );
}
