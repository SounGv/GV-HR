"use client";

import { useState } from "react";
import { CalendarX2, ChevronRight, MapPin } from "lucide-react";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAttendance } from "@/features/attendance/hooks";
import { AttendanceStatusBadge, WORK_MODE_LABEL } from "@/features/attendance/status-badge";
import type { AttendanceRecord } from "@/features/attendance/types";
import { MobileAttendanceDetailDialog } from "./mobile-attendance-detail-dialog";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

function workedHours(r: AttendanceRecord): string {
  if (!r.clockInAt || !r.clockOutAt) return "-";
  const ms = new Date(r.clockOutAt).getTime() - new Date(r.clockInAt).getTime();
  if (ms <= 0) return "-";
  return `${(ms / 3_600_000).toFixed(1)} ชม.`;
}

/**
 * Card-list rendering of the same `useAttendance("me")` data the desktop
 * `AttendanceHistory` table uses — swaps the 6-column table (which forces
 * horizontal scroll on phones) for one row per day, no new data logic.
 */
export function MobileAttendanceHistory() {
  const { data, isLoading, isError, refetch } = useAttendance("me");
  const records = data?.data ?? [];
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={5} />;
  if (records.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="ยังไม่มีประวัติการลงเวลา"
        description="เมื่อคุณเช็คอิน ประวัติจะแสดงที่นี่"
      />
    );
  }

  return (
    <>
      <div className="space-y-2">
        {records.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="w-full rounded-xl bg-card p-3.5 text-left shadow-sm active:bg-muted"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{fmtDate(r.workDate)}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <AttendanceStatusBadge status={r.status} />
                {r.earlyLeaveOut && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    ออกก่อนเวลา
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-sm tabular-nums text-foreground">
                {fmtTime(r.clockInAt)} → {fmtTime(r.clockOutAt)}
              </p>
              <p className="text-xs text-muted-foreground">{workedHours(r)}</p>
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {WORK_MODE_LABEL[r.workMode]}
              </p>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
      <MobileAttendanceDetailDialog record={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
