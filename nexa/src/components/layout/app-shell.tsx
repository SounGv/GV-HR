"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AiChatPanel } from "@/features/ai/floating-ai-launcher";
import { AiPanelProvider } from "@/features/ai/ai-panel-context";
import { MobileContentWrapper } from "@/components/mobile/mobile-content-wrapper";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { HOME_PATH } from "./app-shell-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ProfileDrawer } from "./profile-drawer";
import { ProfileDrawerProvider } from "./profile-drawer-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Desktop sidebar only shows on the home dashboard — every other route
  // gets the full-width page plus a back button (app-topbar.tsx), instead
  // of the nav strip riding along on every page. Controlled (not just a
  // different default) so navigating away from home always collapses it
  // even if someone had it manually toggled open.
  const pathname = usePathname();
  const isHome = pathname === HOME_PATH;
  const [sidebarOpen, setSidebarOpen] = useState(isHome);
  useEffect(() => setSidebarOpen(isHome), [isHome]);

  return (
    <ProfileDrawerProvider>
      <AiPanelProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <AppBadgeSync />
          <AppSidebar />
          {/* Installed on iPhone the app is drawn under the status bar (black-translucent +
              viewport-fit=cover), so the clock needs a coloured strip behind it and the page
              starts below it. env() is 0 everywhere else, so nothing changes off iOS. */}
          <div
            aria-hidden="true"
            className="fixed inset-x-0 top-0 z-[60] h-[env(safe-area-inset-top)] bg-[#0D9488] dark:bg-[#0A0E1A]"
          />
          <SidebarInset className="bg-background pt-[env(safe-area-inset-top)]">
            {/* The wrapper itself sticks: a sticky header inside a plain div scrolls away with it,
                which left page header bars (md:top-16) floating 64px below an empty strip. */}
            <div className="hidden md:sticky md:top-[env(safe-area-inset-top)] md:z-30 md:block">
              <AppTopbar />
            </div>
            <main className="gv-main min-w-0 flex-1 pb-24 md:space-y-6 md:p-6 md:pb-6">
              <Suspense fallback={children}>
                <MobileContentWrapper>{children}</MobileContentWrapper>
              </Suspense>
            </main>
          </SidebarInset>
          <MobileBottomNav />
          <AiChatPanel />
        </SidebarProvider>
      </AiPanelProvider>
      <ProfileDrawer />
    </ProfileDrawerProvider>
  );
}
