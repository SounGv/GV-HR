"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AiChatPanel } from "@/features/ai/floating-ai-launcher";
import { AiPanelProvider } from "@/features/ai/ai-panel-context";
import { MobileContentWrapper } from "@/components/mobile/mobile-content-wrapper";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { AppSidebar } from "./app-sidebar";
import { SectionBand } from "./section-band";
import { PageChromeProvider } from "./page-chrome";
import { HOME_PATH } from "./app-shell-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ProfileDrawer } from "./profile-drawer";
import { ProfileDrawerProvider } from "./profile-drawer-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Desktop sidebar only shows on the home dashboard — every other route
  // gets the full-width page under the top band (section-band.tsx), whose tabs
  // replace the nav strip riding along on every page. Controlled (not just a
  // different default) so navigating away from home always collapses it
  // even if someone had it manually toggled open.
  const pathname = usePathname();
  const isHome = pathname === HOME_PATH;
  const [sidebarOpen, setSidebarOpen] = useState(isHome);
  useEffect(() => setSidebarOpen(isHome), [isHome]);

  return (
    <ProfileDrawerProvider>
      <AiPanelProvider>
        <PageChromeProvider>
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
            {/* The wrapper itself sticks: a sticky header inside a plain div scrolls away with it. One layer only:
                the band holds the menu button, the path, the group's tabs and the page's buttons (92px). */}
            <div className="hidden md:sticky md:top-[env(safe-area-inset-top)] md:z-30 md:block">
              <SectionBand />
            </div>
            <main className="gv-main min-w-0 flex-1 pb-24 md:space-y-6 md:px-6 md:pt-3 md:pb-6">
              <Suspense fallback={children}>
                <MobileContentWrapper>{children}</MobileContentWrapper>
              </Suspense>
            </main>
          </SidebarInset>
          <MobileBottomNav />
          <AiChatPanel />
        </SidebarProvider>
        </PageChromeProvider>
      </AiPanelProvider>
      <ProfileDrawer />
    </ProfileDrawerProvider>
  );
}
