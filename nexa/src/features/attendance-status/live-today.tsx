"use client";

import { createContext, useContext, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { api, type Envelope } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  AttendanceAttentionCards,
  AttendanceFollowChips,
  AttendanceStatusBar,
  AttendanceStatusTiles,
  DepartmentBreakdownCard,
} from "./attendance-today-sections";
import type { TodayAttendance } from "./types";

/** How often today's attendance numbers are read again while the page is in view. */
export const TODAY_REFRESH_MS = 30_000;
/** How often the rest of the dashboard (approvals, headcount, trends) is rebuilt while in view; it is far heavier. */
export const PAGE_REFRESH_MS = 5 * 60_000;

interface LiveTodayValue {
  data: TodayAttendance;
  departmentIds: string[];
  /** Reads today's numbers now and rebuilds the rest of the page. */
  refreshAll: () => void;
  refreshing: boolean;
  /** When the numbers on screen were last read (ms since epoch). */
  updatedAt: number;
}

const LiveTodayContext = createContext<LiveTodayValue | null>(null);

function useLiveToday(): LiveTodayValue {
  const value = useContext(LiveTodayContext);
  if (!value) throw new Error("Live attendance components must be used inside <LiveTodayProvider>");
  return value;
}

/**
 * Keeps the dashboard current without a reload. Today's attendance (cheap, about
 * half a second) is read again every 30 seconds; the whole page is rebuilt every
 * 5 minutes. Both pause while the tab is hidden and catch up when it comes back.
 *
 * @param initial What the server already rendered, or null when this person may not see attendance.
 * @param departmentIds The department filter from the address.
 */
export function LiveTodayProvider({
  initial,
  departmentIds,
  children,
}: {
  initial: TodayAttendance | null;
  departmentIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, startTransition] = useTransition();
  const filterKey = departmentIds.join(",");
  const queryKey = ["today-attendance", filterKey] as const;

  const query = useQuery({
    queryKey,
    enabled: initial !== null,
    queryFn: async () => {
      const params = new URLSearchParams();
      for (const id of departmentIds) params.append("dept", id);
      const res = await api.get<Envelope<TodayAttendance>>(`/api/dashboard/today-attendance?${params.toString()}`);
      return res.data;
    },
    initialData: initial ?? undefined,
    initialDataUpdatedAt: () => Date.now(),
    staleTime: 15_000,
    refetchInterval: TODAY_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // When the server rebuilds the page it hands over fresh numbers; show them rather than waiting for the next read.
  useEffect(() => {
    if (initial) qc.setQueryData(queryKey, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Rebuild the whole page now and then, only while someone is looking at it.
  const lastRebuild = useRef(Date.now());
  useEffect(() => {
    const rebuild = () => {
      if (document.visibilityState !== "visible") return;
      lastRebuild.current = Date.now();
      startTransition(() => router.refresh());
    };
    const timer = window.setInterval(rebuild, PAGE_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRebuild.current >= PAGE_REFRESH_MS) rebuild();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  const refreshAll = () => {
    lastRebuild.current = Date.now();
    startTransition(() => router.refresh());
    void query.refetch();
  };

  const data = query.data ?? initial;
  const value: LiveTodayValue | null = data
    ? { data, departmentIds, refreshAll, refreshing: pending || query.isFetching, updatedAt: query.dataUpdatedAt }
    : null;

  return <LiveTodayContext.Provider value={value}>{children}</LiveTodayContext.Provider>;
}

export function LiveStatusBar() {
  const { data, departmentIds } = useLiveToday();
  return <AttendanceStatusBar data={data} departmentIds={departmentIds} />;
}

export function LiveFollowChips() {
  const { data, departmentIds } = useLiveToday();
  return <AttendanceFollowChips data={data} departmentIds={departmentIds} />;
}

export function LiveStatusTiles() {
  const { data, departmentIds } = useLiveToday();
  return <AttendanceStatusTiles data={data} departmentIds={departmentIds} />;
}

export function LiveAttentionCards() {
  const { data, departmentIds } = useLiveToday();
  return <AttendanceAttentionCards data={data} departmentIds={departmentIds} />;
}

export function LiveDepartmentBreakdown() {
  const { data, departmentIds } = useLiveToday();
  return <DepartmentBreakdownCard data={data} departmentIds={departmentIds} />;
}

const clock = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });

/** "Updated automatically" line with the time of the last read and a button to refresh at once. */
export function LiveStamp() {
  const { refreshAll, refreshing, updatedAt } = useLiveToday();
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="off">
      <span className="tabular-nums">
        อัปเดตล่าสุด {clock.format(updatedAt)} · อัปเดตเองทุก {TODAY_REFRESH_MS / 1000} วินาที
      </span>
      <Button type="button" variant="outline" size="sm" onClick={refreshAll} disabled={refreshing} aria-label="รีเฟรชข้อมูลตอนนี้">
        <RefreshCw className={refreshing ? "size-4 animate-spin motion-reduce:animate-none" : "size-4"} />
        รีเฟรช
      </Button>
    </div>
  );
}
