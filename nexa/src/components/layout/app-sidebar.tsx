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
import { NAV_GROUPS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

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
          const items = group.items.filter((item) => can(item.permission));
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
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            isActive={active}
                            tooltip={item.label}
                            className="h-10 text-[15px] [&_svg]:size-[18px]"
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/nexa-logo.svg" alt="GV One" className="size-10 shrink-0 rounded-lg" />
      <div className="leading-tight group-data-[collapsible=icon]:hidden">
        <div className="text-base font-semibold tracking-wide text-white">GV ONE</div>
        <div className="text-[11px] font-medium tracking-[0.16em] text-slate-400">
          HR AI PLATFORM
        </div>
      </div>
    </div>
  );
}
