"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAttendance } from "./hooks";
import { AttendanceStatusBadge, WORK_MODE_LABEL } from "./status-badge";
import type { AttendanceRecord } from "./types";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function workedHours(r: AttendanceRecord): string {
  if (!r.clockInAt || !r.clockOutAt) return "-";
  const ms = new Date(r.clockOutAt).getTime() - new Date(r.clockInAt).getTime();
  if (ms <= 0) return "-";
  return `${(ms / 3_600_000).toFixed(1)} ชม.`;
}

export function AttendanceHistory() {
  const { data, isLoading, isError, refetch } = useAttendance("me");
  const records = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={6} />;
  if (records.length === 0) {
    return <EmptyState title="ยังไม่มีประวัติการลงเวลา" description="เมื่อคุณเช็คอิน ประวัติจะแสดงที่นี่" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>วันที่</TableHead>
            <TableHead>เวลาเข้า</TableHead>
            <TableHead>เวลาออก</TableHead>
            <TableHead>ชั่วโมงทำงาน</TableHead>
            <TableHead>ประเภท</TableHead>
            <TableHead>สถานะ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{fmtDate(r.workDate)}</TableCell>
              <TableCell className="font-mono tabular-nums">{fmtTime(r.clockInAt)}</TableCell>
              <TableCell className="font-mono tabular-nums">{fmtTime(r.clockOutAt)}</TableCell>
              <TableCell className="text-muted-foreground">{workedHours(r)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{WORK_MODE_LABEL[r.workMode]}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <AttendanceStatusBadge status={r.status} />
                  {r.earlyLeaveOut && (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                      ออกก่อนเวลา
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
