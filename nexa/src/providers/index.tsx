"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./query-provider";
import { ThemeColorSync } from "./theme-color-sync";

/** How long an error toast stays: the 4 s default is too short to read a message and find which field it is about. A call can still pass its own `duration`. */
const ERROR_TOAST_MS = 10_000;

function ErrorToastDuration() {
  useEffect(() => {
    const original = toast.error;
    toast.error = ((message, data) => original(message, { duration: ERROR_TOAST_MS, ...data })) as typeof toast.error;
    return () => {
      toast.error = original;
    };
  }, []);
  return null;
}

/**
 * App-wide client providers: theme (light/dark), React Query, tooltips, toasts.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <ThemeColorSync />
      <ErrorToastDuration />
      <QueryProvider>
        <TooltipProvider delay={200}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
