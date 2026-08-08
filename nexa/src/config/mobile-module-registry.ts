"use client";

import type { ComponentType } from "react";
import {
  MobileBenefitModule,
  MobileFeedbackModule,
  MobileGoalsModule,
} from "@/components/mobile/modules/employee-modules";
import { MobileMenuSettingsModule } from "@/components/mobile/modules/hr-modules";

/**
 * Route → dedicated mobile screen, for the handful of cases with no real
 * backend feature to fall back to (honest "coming soon" placeholders) or a
 * mobile-only concern (home menu customization). Every other route falls
 * through to the real desktop page content via the auto-shell wrapper —
 * see mobile-content-wrapper.tsx — rather than a bespoke mockup that was
 * never wired to the actual API.
 */
export function resolveMobileModule(
  pathname: string,
  searchParams: URLSearchParams,
): ComponentType | null {
  const view = searchParams.get("view");
  const title = searchParams.get("title");

  if (pathname === "/coming-soon") {
    if (title === "เป้าหมาย") return MobileGoalsModule;
    if (title === "ฟีดแบ็ก") return MobileFeedbackModule;
    if (title === "สวัสดิการ") return MobileBenefitModule;
  }

  if (pathname === "/services" && view === "menu-settings") return MobileMenuSettingsModule;

  return null;
}
