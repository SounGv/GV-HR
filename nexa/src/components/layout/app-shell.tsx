"use client";

import { Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FloatingAiLauncher } from "@/features/ai/floating-ai-launcher";
import { MobileContentWrapper } from "@/components/mobile/mobile-content-wrapper";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
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
      <div className="hidden md:block">
        <FloatingAiLauncher />
      </div>
    </SidebarProvider>
  );
}
