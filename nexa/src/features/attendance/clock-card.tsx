"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, MapPin, CheckCircle2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "./hooks";
import { AttendanceStatusBadge } from "./status-badge";
import { CheckInDialog } from "./check-in-dialog";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function ClockCard() {
  const { data, isLoading } = useToday();
  const [dialogKind, setDialogKind] = useState<"in" | "out" | null>(null);

  // Live Bangkok clock
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const record = data?.data ?? null;
  const hasIn = !!record?.clockInAt;
  const hasOut = !!record?.clockOutAt;

  const todayLabel = now
    ? new Intl.DateTimeFormat("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Bangkok",
      }).format(now)
    : "";
  const clockLabel = now
    ? new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Bangkok",
      }).format(now)
    : "--:--:--";

  return (
    <section className="relative overflow-hidden rounded-3xl bg-sidebar p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-primary/25 blur-[100px]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2.5">
          <p className="text-sm text-slate-400">{todayLabel}</p>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
              {clockLabel}
            </span>
            {record && <AttendanceStatusBadge status={record.status} />}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
              <span className="size-1.5 rounded-full bg-success" /> ระบบ GPS + Geofence พร้อม
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="size-3.5" /> ลงเวลาได้เมื่ออยู่ในพื้นที่สาขา
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3">
          {isLoading ? (
            <Skeleton className="h-11 w-full bg-white/10" />
          ) : hasOut ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/15 px-4 py-3 text-success">
              <CheckCircle2 className="size-5" /> ลงเวลาครบแล้ววันนี้
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="lg"
                className="flex-1 gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 disabled:opacity-40"
                disabled={hasIn}
                onClick={() => setDialogKind("in")}
              >
                <LogIn className="size-4" /> เช็คอิน
                <QrCode className="size-4 opacity-80" />
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40"
                disabled={!hasIn}
                onClick={() => setDialogKind("out")}
              >
                <LogOut className="size-4" /> เช็คเอาท์
              </Button>
            </div>
          )}
          {!isLoading && !hasOut && (
            <p className="text-center text-xs text-slate-400">
              {hasIn ? "เช็คอินแล้ว — เลือกเช็คเอาท์เมื่อเลิกงาน" : "เลือกเช็คอินเมื่อเริ่มงาน"}
            </p>
          )}
        </div>
      </div>

      {/* In / out summary */}
      <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
        <div>
          <p className="text-xs text-slate-400">เวลาเข้า</p>
          <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">
            {fmtTime(record?.clockInAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400">เวลาออก</p>
          <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">
            {fmtTime(record?.clockOutAt)}
          </p>
        </div>
      </div>

      <CheckInDialog
        open={dialogKind !== null}
        kind={dialogKind ?? "in"}
        onOpenChange={(v) => !v && setDialogKind(null)}
      />
    </section>
  );
}
