"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

      {can("ai:read") && (
        <SidebarFooter className="p-2">
          <Link
            href="/ai"
            className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-primary to-blue-600 p-3 text-white shadow-sm transition hover:shadow-md group-data-[collapsible=icon]:hidden"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Sparkles className="size-4" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold">AI Assistant</span>
              <span className="flex items-center gap-1 text-[11px] text-white/80">
                <span className="size-1.5 rounded-full bg-emerald-300" /> Online · พูดคุยกับ AI
              </span>
            </span>
          </Link>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}

function NexaHeaderLogo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/nexa-logo.svg" alt="NEXA" className="size-8 shrink-0 rounded-lg" />
      <div className="leading-tight group-data-[collapsible=icon]:hidden">
        <div className="text-sm font-semibold tracking-wide text-white">NEXA</div>
        <div className="text-[10px] font-medium tracking-[0.16em] text-slate-400">
          HR AI PLATFORM
        </div>
      </div>
    </div>
  );
}
