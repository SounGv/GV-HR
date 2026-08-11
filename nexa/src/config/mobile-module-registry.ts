"use client";

import type { ComponentType } from "react";
import { MobileMenuSettingsModule } from "@/components/mobile/modules/hr-modules";
import { MobileCalendarView } from "@/components/mobile/mobile-calendar-view";

/**
 * Route → dedicated mobile screen, for mobile-only concerns (home menu
 * customization) and routes whose desktop layout doesn't fit phone width
 * well enough to just auto-shell-wrap (the org calendar's dense grid).
 * Every other route — including `/coming-soon`, for modules with no
 * backend feature yet — falls through to the real desktop page content via
 * the auto-shell wrapper (see mobile-content-wrapper.tsx) rather than a
 * bespoke mockup that was never wired to an actual API.
 */
export function resolveMobileModule(
  pathname: string,
  searchParams: URLSearchParams,
): ComponentType | null {
  const view = searchParams.get("view");

  if (pathname === "/services" && view === "menu-settings") return MobileMenuSettingsModule;
  if (pathname === "/calendar") return MobileCalendarView;

  return null;
}
