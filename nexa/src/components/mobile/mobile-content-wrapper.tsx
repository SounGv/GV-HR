"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveMobileModule } from "@/config/mobile-module-registry";
import { isMobileCustomPath, resolveMobileRoute, resolveMobilePageMeta } from "@/config/mobile-routes";
import { MobileScreen } from "./mobile-screen";

/**
 * Mobile routing priority:
 * 1. Registered GV One module (custom paths + /services?view=)
 * 2. Page-owned layout on MOBILE_CUSTOM_PATHS without a module
 * 3. Auto shell with route title for all other pages
 */
export function MobileContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const route = useMemo(
    () => resolveMobileRoute(pathname, searchParams),
    [pathname, searchParams],
  );

  const pageMeta = useMemo(
    () => resolveMobilePageMeta(pathname, searchParams),
    [pathname, searchParams],
  );

  if (!isMobile) {
    return <>{children}</>;
  }

  if (route) {
    const Module = resolveMobileModule(route.key);
    if (Module) return <Module />;
  }

  if (isMobileCustomPath(pathname, searchParams)) {
    return <>{children}</>;
  }

  return (
    <MobileScreen
      title={pageMeta.title}
      backHref={pageMeta.backHref}
      contentClassName="mobile-module-body space-y-4 p-4"
    >
      {children}
    </MobileScreen>
  );
}
