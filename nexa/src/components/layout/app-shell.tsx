"use client";

import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AiChatPanel } from "@/features/ai/floating-ai-launcher";
import { AiPanelProvider } from "@/features/ai/ai-panel-context";
import { MobileContentWrapper } from "@/components/mobile/mobile-content-wrapper";
import { AppBadgeSync } from "@/components/pwa/app-badge-sync";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ProfileDrawer } from "./profile-drawer";
import { ProfileDrawerProvider } from "./profile-drawer-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProfileDrawerProvider>
      <AiPanelProvider>
        <SidebarProvider>
          <AppBadgeSync />
          <AppSidebar />
          <SidebarInset className="bg-background">
            <div className="hidden md:block">
              <AppTopbar />
            </div>
            <main className="flex-1 pb-24 md:space-y-6 md:p-6 md:pb-6">
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
