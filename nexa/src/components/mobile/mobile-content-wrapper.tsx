"use client";



import { useMemo } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { useIsMobile } from "@/hooks/use-mobile";

import { resolveMobileModule } from "@/config/mobile-module-registry";

import { isMobileCustomPath, resolveMobileRoute } from "@/config/mobile-routes";

import { MobileScreen } from "./mobile-screen";



/**

 * Wraps authenticated page content on phones.

 * 1. Dedicated GV One mockup module (if registered)

 * 2. Page-owned mobile layout (MOBILE_CUSTOM_PATHS)

 * 3. Auto shell with route title for everything else

 */

export function MobileContentWrapper({ children }: { children: React.ReactNode }) {

  const pathname = usePathname();

  const searchParams = useSearchParams();

  const isMobile = useIsMobile();



  const ModuleView = useMemo(

    () => resolveMobileModule(pathname, searchParams),

    [pathname, searchParams],

  );



  const meta = useMemo(

    () => resolveMobileRoute(pathname, searchParams),

    [pathname, searchParams],

  );



  if (!isMobile) {

    return <>{children}</>;

  }



  if (ModuleView) {

    return <ModuleView />;

  }



  if (isMobileCustomPath(pathname)) {

    return <>{children}</>;

  }



  return (

    <MobileScreen

      title={meta.title}

      backHref={meta.backHref}

      contentClassName="mobile-module-body space-y-4 p-4 pb-36"

    >

      {children}

    </MobileScreen>

  );

}


