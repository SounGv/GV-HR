"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopbar />
        {/* pb clears the fixed mobile bottom nav (h-16 + safe-area) */}
        <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
