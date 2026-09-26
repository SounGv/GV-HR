"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Michroma } from "next/font/google";
import { ChevronDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";

const michroma = Michroma({ subsets: ["latin"], weight: "400" });

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
  const pendingApprovals = (leavePendingQ.data?.data.length ?? 0) + (otPendingQ.data?.data.length ?? 0);

  const canReview = can("performance:read");
  const pendingReviewsQ = useMyPendingResponses();
  const pendingReviews = canReview ? (pendingReviewsQ.data?.data.length ?? 0) : 0;

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

  // The initializer above only runs once on mount — deep-linking into a
  // different, currently-collapsed group later (e.g. a notification link)
  // otherwise leaves that group collapsed with no visible active state. Only
  // expand the group the new route landed in; leave every other group's
  // manually-set collapse state untouched.
  useEffect(() => {
    setOpen((prev) => {
      const activeGroup = NAV_GROUPS.find((g) => groupHasActive(g.items));
      if (!activeGroup || prev[activeGroup.label]) return prev;
      return { ...prev, [activeGroup.label]: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  return (
    <Sidebar>
      <SidebarHeader className="justify-center px-4 py-3 group-data-[collapsible=icon]:h-16">
        <Link href="/dashboard" aria-label="GV One">
          {/* Import kept inline to avoid a client/server import cycle warning */}
          <NexaHeaderLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0.5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canSee(item.permission));
          if (items.length === 0) return null;

          const expanded = open[group.label] ?? false;
          return (
            <SidebarGroup key={group.label} className="py-0.5">
              <button
                type="button"
                onClick={() => toggle(group.label)}
                aria-expanded={expanded}
                className="flex h-[46px] w-full items-center gap-3 rounded-xl px-2.5 text-[15px] font-semibold text-slate-200 transition hover:bg-sidebar-accent hover:text-white"
              >
                <span
                  className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px]"
                  style={{ background: group.chipColor }}
                >
                  <group.icon className="size-[18px] text-white" strokeWidth={2.25} />
                </span>
                <span className="flex-grow text-left tracking-wide">{group.label}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <SidebarGroupContent className="mt-0.5 mb-1.5 ml-6 border-l-2 border-sidebar-accent pl-3.5">
                  <SidebarMenu>
                    {items.map((item) => {
                      const active = isActive(item.href);
                      const href = item.ready
                        ? item.href
                        : `/coming-soon?title=${encodeURIComponent(item.label)}`;
                      const badge = item.badgeKey ? badgeValue(item.badgeKey) : 0;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={item.label}
                            className={cn(
                              "h-9 text-[14px] [&_svg]:size-4",
                              active
                                ? "data-active:bg-sidebar-primary data-active:font-bold data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground"
                                : "text-[#E6E8EA] hover:text-white",
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
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                          {!item.ready && (
                            <SidebarMenuBadge className="text-[10px] text-slate-400">
                              เร็วๆ นี้
                            </SidebarMenuBadge>
                          )}
                          {item.ready && badge > 0 && (
                            <SidebarMenuBadge className="bg-badge text-badge-foreground">
                              {badge > 9 ? "9+" : badge}
                            </SidebarMenuBadge>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

function NexaHeaderLogo() {
  return (
    <div className="flex w-full items-center justify-center">
      {/* Icon-only mark when the sidebar is collapsed to icon width */}
      <Logo size={40} className="hidden size-10 group-data-[collapsible=icon]:block" />

      {/* Full gradient lockup box when expanded */}
      <div
        className="hidden w-full flex-col items-center gap-2.5 rounded-[18px] border border-[#2E3338] bg-[linear-gradient(180deg,#24282C_0%,#131516_100%)] px-3 pt-[18px] pb-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08),0_8px_20px_rgb(0_0_0_/_0.45)] group-data-[collapsible=icon]:hidden md:flex"
      >
        <Logo size={150} className="h-[73px] w-[150px] drop-shadow-[0_6px_10px_rgb(0_0_0_/_0.6)] drop-shadow-[0_0_14px_rgb(205_235_3_/_0.22)]" />
        <div className="h-[2px] w-[176px] rounded-full bg-[linear-gradient(90deg,rgb(205_235_3_/_0)_0%,#CDEB03_50%,rgb(205_235_3_/_0)_100%)]" />
        <div
          className={cn(
            michroma.className,
            "bg-[linear-gradient(180deg,#FFFFFF_0%,#E4E7EA_45%,#9AA1A8_100%)] bg-clip-text text-[12px] leading-tight tracking-[0.24em] whitespace-nowrap text-transparent",
          )}
          style={{ paddingLeft: "0.24em", filter: "drop-shadow(0 1px 0 #5E6670) drop-shadow(0 3px 3px rgb(0 0 0 / 0.7))" }}
        >
          GADGET VILLA
        </div>
        <div
          className={cn(
            michroma.className,
            "flex items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#DDF53A_0%,#CDEB03_55%,#A9C400_100%)] py-1 text-[11px] leading-normal tracking-[0.2em] text-[#131516] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.55),0_3px_8px_rgb(205_235_3_/_0.25)]",
          )}
          style={{ paddingLeft: "calc(14px + 0.2em)", paddingRight: "14px" }}
        >
          ONE HR
        </div>
      </div>
    </div>
  );
}
