"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveMobileRoute } from "@/config/mobile-routes";
import { resolveMobileModule } from "@/config/mobile-module-registry";
import { MobileOnly, DesktopOnly } from "./mobile-screen";

export interface MobileContentWrapperProps {
  children: React.ReactNode;
}

/**
 * On mobile custom paths, renders the registered module inside the mobile shell.
 * On desktop (or non-custom paths), passes through the default page children.
 */
export function MobileContentWrapper({ children }: MobileContentWrapperProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = resolveMobileRoute(pathname, searchParams);

  if (!route) {
    return <>{children}</>;
  }

  const Module = resolveMobileModule(route.key);

  return (
    <>
      <MobileOnly>{Module ? <Module /> : children}</MobileOnly>
      <DesktopOnly>{children}</DesktopOnly>
    </>
  );
}

export { isMobileCustomPath } from "@/config/mobile-routes";
