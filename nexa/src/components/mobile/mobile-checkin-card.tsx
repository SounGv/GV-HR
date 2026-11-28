"use client";

import { useEffect, useState } from "react";
import { Building2, Camera, CheckCircle2, Home, MapPinned, ShieldCheck, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentPosition, distanceMeters } from "@/lib/geolocation";
import { isPhoneWidth } from "@/lib/viewport";
import { useAuth } from "@/features/auth/auth-context";
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
  const { user } = useAuth();
  // An account with no employee record has no clock-in of its own; say so instead of showing a failed load.
  if (!user.employee) {
    return (
      <section role="status" className="gv-lg-card flex items-start gap-3 p-4 text-foreground">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <UserRoundX className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold">บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน</p>
          <p className="mt-0.5 text-sm text-muted-foreground">จึงไม่มีการลงเวลาของตัวเอง ถ้าต้องลงเวลา ให้ HR ผูกบัญชีกับข้อมูลพนักงานก่อน</p>
        </div>
      </section>
    );
  }
  return <MobileCheckinCardForEmployee />;
}

function MobileCheckinCardForEmployee() {
  const { data, isLoading, isError, refetch } = useToday();
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
    // This card is also drawn (and hidden by CSS) on a desktop home page: only a phone should ask for the location.
    if (hasOut || isWfh || !isPhoneWidth()) return;
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

  // Unknown when today could not load: never say "ready" for someone who may already be in.
  const statusLabel = isError ? "ยังโหลดเวลาวันนี้ไม่ได้" : hasOut ? "ออกงานแล้ว" : hasIn ? "เข้างานแล้ว" : "พร้อมเข้างาน";
  const clockLabel = now
    ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }).format(now)
    : "--:--:--";
  const showDistance = gpsReady && distance != null && !hasOut && !isWfh;

  return (
    <>
      <section className="gv-lg-card relative overflow-hidden p-5 text-foreground">
        <div className="relative flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[#1976d2]" />
            สถานะวันนี้
          </span>
          {!hasOut && !isWfh && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
                gpsReady ? "bg-card text-foreground" : "bg-warning/15 text-warning",
              )}
            >
              <MapPinned className="size-3" /> {gpsReady ? "GPS พร้อม" : "กำลังค้นหา…"}
            </span>
          )}
        </div>

        <p className="relative mt-1.5 text-2xl font-bold tracking-tight text-accent-foreground">{statusLabel}</p>
        <p className="relative mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {isWfh ? <Home className="size-3.5" /> : <Building2 className="size-3.5" />}
          {isWfh ? WORK_MODE_LABEL.WFH : (branch?.name ?? "ไม่ระบุสาขา")}
        </p>

        <div className="relative mt-4 border-t border-[var(--lg-edge)] pt-4">
          <div className={cn("grid gap-3", showDistance ? "grid-cols-2" : "grid-cols-1")}>
            <div>
              <p className="text-xs text-muted-foreground">เวลา ณ ปัจจุบัน</p>
              <p className="mt-0.5 font-mono text-xl font-semibold tracking-tight tabular-nums">{clockLabel}</p>
            </div>
            {showDistance && (
              <div>
                <p className="text-xs text-muted-foreground">ระยะห่างจากที่ทำงาน</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums">
                  {Math.round(distance!).toLocaleString()} <span className="text-xs font-medium text-muted-foreground">เมตร</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="relative mt-4 border-t border-[var(--lg-edge)] pt-4">
          {isLoading ? (
            <div className="h-13 w-full animate-pulse motion-reduce:animate-none rounded bg-card/60" />
          ) : isError ? (
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-13 w-full items-center justify-center gap-2 rounded border border-destructive/40 bg-card text-base font-semibold text-destructive"
            >
              โหลดเวลาวันนี้ไม่สำเร็จ กดเพื่อลองใหม่
            </button>
          ) : hasOut ? (
            <div className="flex h-13 items-center justify-center gap-2 rounded bg-success text-sm font-semibold text-success-foreground">
              <CheckCircle2 className="size-4.5" /> ลงเวลาครบแล้ววันนี้
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlowMode(hasIn ? "out" : "in")}
              className="flex h-13 w-full items-center justify-center gap-2 rounded bg-primary text-base font-semibold text-primary-foreground hover:bg-[#1565c0] active:scale-[0.99]"
            >
              <Camera className="size-5" /> {hasIn ? "ลงเวลาออกงาน" : "ลงเวลาเข้างาน"}
            </button>
          )}
          {!hasOut && !isError && (
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-sm text-muted-foreground">
              {isWfh ? (
                "ทำงานจากที่บ้าน — ไม่ต้องถ่ายรูป/ตรวจตำแหน่ง"
              ) : (
                <>
                  <ShieldCheck className="size-3.5" /> ยืนยันตัวตนด้วยกล้องเพื่อความปลอดภัย
                </>
              )}
            </p>
          )}
        </div>
      </section>

      <div className="gv-lg-card mt-3 grid grid-cols-3 gap-2 p-3.5 text-center">
        <div>
          <p className="text-xs text-muted-foreground">เวลาเข้า</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{fmtTime(record?.clockInAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">เวลาออก</p>
          <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{fmtTime(record?.clockOutAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">เวลาทำงาน</p>
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
