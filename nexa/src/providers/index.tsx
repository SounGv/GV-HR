"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./query-provider";
import { MobileDefaultDarkTheme } from "./mobile-default-dark-theme";

/**
 * App-wide client providers: theme (light/dark), React Query, tooltips, toasts.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MobileDefaultDarkTheme />
      <QueryProvider>
        <TooltipProvider delay={200}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
