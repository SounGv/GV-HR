"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";
import { HOME_PATH } from "./app-shell-nav";

export function AppTopbar() {
  const pathname = usePathname();
  const isHome = pathname === HOME_PATH;

  return (
    // Opaque, not the semi-transparent bg-background/70 + backdrop-blur-xl this
    // used to have: that blur is compositing-heavy and, right at the seam with
    // the sidebar's own `fixed` element, showed up as a torn/diagonal seam
    // artifact while scrolling (reported live, reproducible on desktop Chrome).
    // A solid header removes the blur layer entirely, so there's nothing left
    // to visually tear.
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 [will-change:transform] sm:h-16 sm:px-5">
      {isHome ? (
        <SidebarTrigger className="-ml-1" />
      ) : (
        <Link
          href={HOME_PATH}
          aria-label="กลับหน้าหลัก"
          className="-ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
      )}
      <Separator orientation="vertical" className="mx-1 h-5" />

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <NotificationBell />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <UserMenu />
      </div>
    </header>
  );
}
