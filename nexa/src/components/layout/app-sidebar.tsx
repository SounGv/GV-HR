"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { Logo, LogoHorizontal } from "@/components/shared/logo";

export function AppSidebar() {
  const pathname = usePathname();
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
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
  }, [pathname]);

  return (
    <Sidebar>
      <SidebarHeader className="h-16 justify-center px-4">
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
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-slate-300 transition hover:text-slate-100"
              >
                <span className="tracking-wide">{group.label}</span>
                <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <SidebarGroupContent>
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
                              "h-10 text-[15px] [&_svg]:size-[18px]",
                              active &&
                                "data-active:bg-[#bbf7d0] data-active:font-bold data-active:text-[#15803d] data-active:hover:bg-[#bbf7d0] data-active:hover:text-[#15803d]",
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
                            <item.icon strokeWidth={2.8} />
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
    <div className="flex items-center">
      {/* Icon-only mark when the sidebar is collapsed to icon width */}
      <Logo size={40} className="hidden size-10 group-data-[collapsible=icon]:block" variant="dark" />
      {/* Full horizontal lockup (icon + wordmark + subtitle baked in) when expanded */}
      <LogoHorizontal height={36} variant="dark" className="group-data-[collapsible=icon]:hidden" />
    </div>
  );
}
