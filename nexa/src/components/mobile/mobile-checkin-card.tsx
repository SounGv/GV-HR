"use client";

import { useEffect, useState } from "react";
import { Building2, Camera, CheckCircle2, Home, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentPosition, distanceMeters } from "@/lib/geolocation";
import { useToday } from "@/features/attendance/hooks";
import { WORK_MODE_LABEL } from "@/features/attendance/status-badge";
import { MobileCheckinFlow } from "./mobile-checkin-flow";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

function fmtWorked(inIso: string | null | undefined, outIso: string | null | undefined) {
  if (!inIso) return "0 ชม.";
  const end = outIso ? new Date(outIso) : new Date();
  const start = new Date(inIso);
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} ชม. ${m} นาที`;
}

/**
 * Slim mobile check-in surface — the ONLY attendance action on phones.
 * Deliberately shows a single primary button (never check-in and check-out
 * together, no QR, no break/mood controls per the mobile UX spec); tapping
 * it opens the full-screen camera+GPS wizard (MobileCheckinFlow). Reuses the
 * same `useToday`/clock-in/out data layer as the desktop ClockCard — no new
 * business logic, only a different presentation.
 */
export function MobileCheckinCard() {
  const { data, isLoading, refetch } = useToday();
  const [flowMode, setFlowMode] = useState<"in" | "out" | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const record = data?.data?.record ?? null;
  const branch = data?.data?.branch ?? null;
  const hasIn = !!record?.clockInAt;
  const hasOut = !!record?.clockOutAt;
  const isWfh = record?.workMode === "WFH";
  const hasGeofence = branch?.lat != null && branch?.lng != null && branch?.radiusMeters != null;

  useEffect(() => {
    if (hasOut || isWfh) return;
    let cancelled = false;
    getCurrentPosition({ timeout: 6000 })
      .then((pos) => {
        if (cancelled) return;
        setGpsReady(true);
        if (hasGeofence) {
          setDistance(distanceMeters(pos.coords.latitude, pos.coords.longitude, branch!.lat!, branch!.lng!));
        }
      })
      .catch(() => {
        if (!cancelled) setGpsReady(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOut, isWfh, hasGeofence]);

  const statusLabel = hasOut ? "เลิกงานแล้ว" : hasIn ? "กำลังทำงาน" : "พร้อมเข้างาน";
  const clockLabel = now
    ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }).format(now)
    : "--:--:--";

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-sidebar p-5 text-white">
        <div className="pointer-events-none absolute -top-20 -right-14 size-64 rounded-full bg-primary/25 blur-[90px]" />

        <div className="relative flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            {isWfh ? <Home className="size-3.5" /> : <Building2 className="size-3.5" />}
            {isWfh ? WORK_MODE_LABEL.WFH : (branch?.name ?? "ไม่ระบุสาขา")}
          </span>
          {!hasOut && !isWfh && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                gpsReady ? "bg-white/10 text-slate-200" : "bg-warning/15 text-warning",
              )}
            >
              <MapPinned className="size-3" /> {gpsReady ? "GPS พร้อม" : "กำลังค้นหา…"}
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums">{clockLabel}</p>
          <p className="mt-0.5 text-xs text-slate-300">
            {statusLabel}
            {gpsReady && distance != null && !hasOut && !isWfh
              ? ` · ห่าง ${Math.round(distance).toLocaleString()} เมตร`
              : ""}
          </p>
        </div>

        <div className="relative mt-4">
          {isLoading ? (
            <div className="h-13 w-full animate-pulse rounded-2xl bg-white/10" />
          ) : hasOut ? (
            <div className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-success text-sm font-semibold text-white">
              <CheckCircle2 className="size-4.5" /> ลงเวลาครบแล้ววันนี้
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlowMode(hasIn ? "out" : "in")}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.99]"
            >
              <Camera className="size-5" /> {hasIn ? "เช็คเอาท์" : "เช็คอิน"}
            </button>
          )}
          {!hasOut && (
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {isWfh ? "ทำงานจากที่บ้าน — ไม่ต้องถ่ายรูป/ตรวจตำแหน่ง" : "กดเพื่อเปิดกล้องถ่ายรูปยืนยันตัวตน"}
            </p>
          )}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-card p-3.5 text-center shadow-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">เวลาเข้า</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{fmtTime(record?.clockInAt)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">เวลาออก</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{fmtTime(record?.clockOutAt)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">เวลาทำงาน</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
            {record?.clockInAt ? fmtWorked(record.clockInAt, record.clockOutAt) : "--"}
          </p>
        </div>
      </div>

      {flowMode && (
        <MobileCheckinFlow
          mode={flowMode}
          skipCapture={isWfh}
          onClose={() => setFlowMode(null)}
          onDone={() => {
            setFlowMode(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
