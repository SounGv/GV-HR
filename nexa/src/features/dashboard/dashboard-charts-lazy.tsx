"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lazy-loaded wrapper around dashboard-charts.tsx, which pulls in recharts —
 * one of the biggest single contributors to /dashboard's First Load JS.
 * dashboard/page.tsx is a server component, where `next/dynamic`'s `ssr: false`
 * is only allowed from a "use client" file, hence this thin wrapper instead of
 * inlining the dynamic import there directly.
 *
 * KpiMiniBars does NOT use recharts and lives in its own file (kpi-mini-bars.tsx)
 * instead — lazy-loading it here caused a React #418 hydration error in
 * production builds only (reproduced and bisected locally), most likely
 * because it renders multiple times per page and can return null itself; it
 * also wasn't buying anything bundle-size-wise since it doesn't need recharts.
 */
export const AttendanceRateLine = dynamic(
  () => import("./dashboard-charts").then((m) => m.AttendanceRateLine),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> },
);
