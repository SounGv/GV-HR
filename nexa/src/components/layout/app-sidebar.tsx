"use client";

import { useState } from "react";
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
import { useLeave } from "@/features/leave/hooks";
import { useOvertime } from "@/features/overtime/hooks";
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";

export function AppSidebar() {
  const pathname = usePathname();
  const { can, logout } = useAuth();
  const { data: aiAccess } = useAiAccess();

  // A grant-only user (see src/lib/ai/scope.ts) has no ai:* key in their JWT
  // claims, so the plain permission filter below would hide "AI Assistant"
  // for them even though the API would let them through.
  const canSee = (permission: string) =>
    can(permission) || (permission === "ai:read" && !!aiAccess?.data.allowed);

  // Live sidebar badges — same data sources already powering the mobile
  // bottom nav's badges, just surfaced here too (a first for desktop).
  const canApproveLeave = can("leave:approve");
  const canApproveOt = can("overtime:approve");
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

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center px-4">
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
                                "data-active:bg-[#E5F6B8] data-active:font-bold data-active:text-[#2F6B24] data-active:hover:bg-[#E5F6B8] data-active:hover:text-[#2F6B24]",
                            )}
                            render={
                              item.isLogout ? (
                                <button type="button" onClick={() => logout()} />
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
    <div className="flex items-center gap-2.5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        <Logo size={36} className="size-9" />
      </div>
      <div className="leading-tight group-data-[collapsible=icon]:hidden">
        <div className="text-lg font-semibold tracking-wide text-white">GV ONE</div>
        <div className="text-[11px] font-medium tracking-[0.16em] text-slate-400">
          HR AI PLATFORM
        </div>
      </div>
    </div>
  );
}
