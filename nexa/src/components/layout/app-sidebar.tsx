"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="h-14 justify-center px-4">
        <Link href="/dashboard" aria-label="NEXA">
          {/* Import kept inline to avoid a client/server import cycle warning */}
          <NexaHeaderLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => can(item.permission));
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const href = item.ready
                      ? item.href
                      : `/coming-soon?title=${encodeURIComponent(item.label)}`;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          render={<Link href={href} />}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {!item.ready && (
                          <SidebarMenuBadge className="text-[10px] text-slate-400">
                            เร็วๆ นี้
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-500 text-sm font-bold text-white">
        N
      </div>
      <div className="leading-tight group-data-[collapsible=icon]:hidden">
        <div className="text-sm font-semibold tracking-wide text-white">NEXA</div>
        <div className="text-[10px] font-medium tracking-[0.16em] text-slate-400">
          PEOPLE PLATFORM
        </div>
      </div>
    </div>
  );
}
