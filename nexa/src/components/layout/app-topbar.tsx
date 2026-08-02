"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 bg-background/70 px-3 backdrop-blur-xl sm:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Global search (Ctrl/⌘K) — command palette */}
      <CommandPalette />

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <NotificationBell />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
