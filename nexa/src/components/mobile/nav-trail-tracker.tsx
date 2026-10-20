"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordArrival } from "./nav-trail";

function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    recordArrival(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}

/** Remembers every page opened in the app this tab, for the mobile back arrow (see nav-trail.ts). */
export function NavTrailTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
