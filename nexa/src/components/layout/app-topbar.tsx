"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { previousOf, readTrail } from "@/components/mobile/nav-trail";
import { HOME_PATH } from "./app-shell-nav";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "./notification-bell";

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === HOME_PATH;

  return (
    // Opaque, not the semi-transparent bg-background/70 + backdrop-blur-xl this
    // used to have: that blur is compositing-heavy and, right at the seam with
    // the sidebar's own `fixed` element, showed up as a torn/diagonal seam
    // artifact while scrolling (reported live, reproducible on desktop Chrome).
    // A solid header removes the blur layer entirely, so there's nothing left
    // to visually tear.
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 [will-change:transform] sm:h-16 sm:px-5">
      <SidebarTrigger className="-ml-1 size-11" />
      {/* The one back control on desktop (13 Nov 2026). It returns to the page the
          person came from, like the phone header; the pages' own back links are
          phone-only (BackLink is md:hidden) so a page never shows two. */}
      {!isHome && (
        <button
          type="button"
          onClick={() => router.push(previousOf(readTrail()) ?? HOME_PATH)}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
          ย้อนกลับ
        </button>
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
