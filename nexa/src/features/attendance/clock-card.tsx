"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import jsQR from "jsqr";
import {
  LogIn,
  LogOut,
  CheckCircle2,
  RotateCcw,
  Home,
  Building2,
  Loader2,
  Camera,
  X,
  AlertTriangle,
  QrCode,
  Coffee,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrentPosition } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useClockIn, useClockOut, useEndBreak, useStartBreak, useToday } from "./hooks";
import { AttendanceStatusBadge } from "./status-badge";
import type { AttendanceMood, AttendanceWorkMode } from "./types";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

const MOOD_OPTIONS: { value: AttendanceMood; emoji: string; label: string }[] = [
  { value: "TERRIBLE", emoji: "😣", label: "Terrible" },
  { value: "BAD", emoji: "🙁", label: "Bad" },
  { value: "OK", emoji: "🙂", label: "OK" },
  { value: "GOOD", emoji: "😊", label: "Good" },
  { value: "EXCELLENT", emoji: "😄", label: "Excellent" },
];

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

const GeofenceMap = dynamic(() => import("./geofence-map").then((m) => m.GeofenceMap), {
  ssr: false,
  loading: () => <div className="h-44 w-full animate-pulse rounded-2xl bg-white/5" />,
});

export function ClockCard() {
  const { data, isLoading, refetch } = useToday();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreakMut = useStartBreak();
  const endBreakMut = useEndBreak();

  const [mode, setMode] = useState<AttendanceWorkMode>("ONSITE");
  const [checking, setChecking] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoIntent, setPhotoIntent] = useState<"in" | "out" | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [offsite, setOffsite] = useState<{
    kind: "in" | "out";
    distance: number;
    branchName: string | null;
    mood?: AttendanceMood;
  } | null>(null);
  const [offsiteReason, setOffsiteReason] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [mapPreview, setMapPreview] = useState<{ kind: "in" | "out"; coords: Coords; mood?: AttendanceMood } | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCoordsRef = useRef<Coords | null>(null);
  const photoRef = useRef<string | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live Bangkok clock
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Camera: only requested once the employee opts in to attaching a photo.
  useEffect(() => {
    if (!photoOpen) return;
    let cancelled = false;
    setCamReady(false);
    setCamError(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamReady(true);
      } catch {
        if (!cancelled) setCamError(true);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [photoOpen]);

  /** Opens the auto-photo step before clocking in/out; resets any stale photo first. */
  function requestPhoto(intent: "in" | "out") {
    photoRef.current = null;
    setPhotoIntent(intent);
    setPhotoOpen(true);
  }

  /** Runs after the photo step closes (captured or skipped) — continues the intent's flow. */
  function proceedAfterPhoto() {
    const intent = photoIntent;
    setPhotoIntent(null);
    if (intent === "in") startClockIn();
    else if (intent === "out") setMoodOpen(true);
  }

  function skipPhoto() {
    setPhotoOpen(false);
    proceedAfterPhoto();
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const side = Math.min(video.videoWidth, video.videoHeight) || 480;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 480, 480);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    photoRef.current = dataUrl;
    setPhotoOpen(false);
    proceedAfterPhoto();
  }

  const record = data?.data?.record ?? null;
  const branch = data?.data?.branch ?? null;
  const hasIn = !!record?.clockInAt;
  const hasOut = !!record?.clockOutAt;
  const onBreak = !!record?.breakStartAt && !record?.breakEndAt;
  const hasGeofence = branch?.lat != null && branch?.lng != null && branch?.radiusMeters != null;

  async function toggleBreak() {
    try {
      if (onBreak) {
        await endBreakMut.mutateAsync();
        toast.success("เลิกพักแล้ว");
      } else {
        await startBreakMut.mutateAsync();
        toast.success("เริ่มพักแล้ว");
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  async function submitClockInViaQr(branchId: string) {
    setChecking(true);
    try {
      await clockIn.mutateAsync({
        qrBranchId: branchId,
        workMode: "ONSITE",
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
      });
      toast.success("เช็คอินด้วย QR สำเร็จ");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "เช็คอินไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  }

  async function submitClockOutViaQr(branchId: string) {
    setChecking(true);
    try {
      await clockOut.mutateAsync({
        qrBranchId: branchId,
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
      });
      toast.success("เช็คเอาท์ด้วย QR สำเร็จ");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "เช็คเอาท์ไม่สำเร็จ");
    } finally {
      setChecking(false);
    }
  }

  // QR scanner: opens the back camera and decodes frames on an interval until
  // a "NEXA-CHECKIN:<branchId>" payload is found, then auto-submits.
  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    setQrReady(false);
    setQrError(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        qrStreamRef.current = stream;
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          await qrVideoRef.current.play().catch(() => {});
        }
        setQrReady(true);
        qrIntervalRef.current = setInterval(() => {
          const video = qrVideoRef.current;
          if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
          if (!qrCanvasRef.current) qrCanvasRef.current = document.createElement("canvas");
          const canvas = qrCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          const prefix = "NEXA-CHECKIN:";
          if (code?.data?.startsWith(prefix)) {
            const branchId = code.data.slice(prefix.length).trim();
            setQrOpen(false);
            if (hasIn) submitClockOutViaQr(branchId);
            else submitClockInViaQr(branchId);
          }
        }, 400);
      } catch {
        if (!cancelled) setQrError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      qrStreamRef.current?.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen]);

  async function resolveCoords(): Promise<Coords | null> {
    try {
      const pos = await getCurrentPosition();
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      lastCoordsRef.current = c;
      return c;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ระบุตำแหน่งไม่สำเร็จ");
      return null;
    }
  }

  async function submitClockIn(reason?: string, cachedCoords?: Coords) {
    setChecking(true);
    try {
      const coords = cachedCoords ?? (reason ? lastCoordsRef.current : await resolveCoords());
      await clockIn.mutateAsync({
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        workMode: mode,
        photo: photoRef.current ?? undefined,
        offsiteReason: reason,
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
      });
      toast.success("เช็คอินสำเร็จ");
      photoRef.current = null;
      setOffsite(null);
      setOffsiteReason("");
      refetch();
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { offsite?: boolean; distance?: number; branchName?: string | null } | undefined) : undefined;
      if (details?.offsite) {
        setOffsite({ kind: "in", distance: details.distance ?? 0, branchName: details.branchName ?? null });
      } else {
        toast.error(err instanceof ApiError || err instanceof Error ? err.message : "เช็คอินไม่สำเร็จ");
      }
    } finally {
      setChecking(false);
    }
  }

  async function submitClockOut(mood?: AttendanceMood, reason?: string, cachedCoords?: Coords) {
    setChecking(true);
    try {
      const coords = cachedCoords ?? (reason ? lastCoordsRef.current : await resolveCoords());
      await clockOut.mutateAsync({
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        mood,
        photo: photoRef.current ?? undefined,
        offsiteReason: reason,
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
      });
      toast.success("เช็คเอาท์สำเร็จ");
      photoRef.current = null;
      setMoodOpen(false);
      setOffsite(null);
      setOffsiteReason("");
      refetch();
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as { offsite?: boolean; distance?: number; branchName?: string | null } | undefined) : undefined;
      if (details?.offsite) {
        setMoodOpen(false);
        setOffsite({ kind: "out", distance: details.distance ?? 0, branchName: details.branchName ?? null, mood });
      } else {
        toast.error(err instanceof ApiError || err instanceof Error ? err.message : "เช็คเอาท์ไม่สำเร็จ");
      }
    } finally {
      setChecking(false);
    }
  }

  /**
   * ONSITE clock-in/out with a configured geofence gets a map confirmation
   * step first; WFH and branches without a geofence submit immediately,
   * matching the existing skip-geofence behavior.
   */
  async function startClockIn() {
    if (mode === "WFH" || !hasGeofence) {
      submitClockIn();
      return;
    }
    setChecking(true);
    const coords = await resolveCoords();
    setChecking(false);
    if (!coords) return;
    setMapPreview({ kind: "in", coords });
  }

  async function startClockOut(mood?: AttendanceMood) {
    if (record?.workMode === "WFH" || !hasGeofence) {
      submitClockOut(mood);
      return;
    }
    setChecking(true);
    const coords = await resolveCoords();
    setChecking(false);
    if (!coords) return;
    setMapPreview({ kind: "out", coords, mood });
  }

  function confirmMapPreview() {
    if (!mapPreview) return;
    if (mapPreview.kind === "in") submitClockIn(undefined, mapPreview.coords);
    else submitClockOut(mapPreview.mood, undefined, mapPreview.coords);
    setMapPreview(null);
  }

  function confirmOffsite() {
    if (!offsiteReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการทำงานนอกสถานที่");
      return;
    }
    if (offsite?.kind === "in") submitClockIn(offsiteReason.trim());
    else submitClockOut(offsite?.mood, offsiteReason.trim());
  }

  const todayLabel = now
    ? new Intl.DateTimeFormat("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(now)
    : "";
  const clockLabel = now
    ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" }).format(now)
    : "--:--:--";

  return (
    <section className="relative overflow-hidden rounded-3xl bg-sidebar p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-primary/25 blur-[100px]" />

      <button
        type="button"
        onClick={() => refetch()}
        aria-label="รีเฟรช"
        className="absolute top-5 right-5 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
      >
        <RotateCcw className="size-4" />
      </button>

      <div className="relative space-y-1.5">
        <p className="text-sm text-slate-400">{todayLabel}</p>
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{clockLabel}</span>
          {record && <AttendanceStatusBadge status={record.status} />}
          {record?.workMode === "WFH" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white">
              <Home className="size-3" /> WFH
            </span>
          )}
        </div>
      </div>

      {/* Mode toggle — persistent, no dialog needed to reach it */}
      {!isLoading && !hasIn && !hasOut && (
        <div className="relative mt-5 flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("ONSITE")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
              mode === "ONSITE" ? "bg-white text-slate-900" : "text-slate-300",
            )}
          >
            <Building2 className="size-3.5" /> สำนักงาน
          </button>
          <button
            type="button"
            onClick={() => setMode("WFH")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
              mode === "WFH" ? "bg-white text-slate-900" : "text-slate-300",
            )}
          >
            <Home className="size-3.5" /> WFH
          </button>
        </div>
      )}

      {/* Primary action — one big, unmistakable button; taps straight through to the API */}
      <div className="relative mt-5">
        {isLoading ? (
          <Skeleton className="h-14 w-full bg-white/10" />
        ) : mapPreview ? null : hasOut ? (
          <div className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="size-5" /> ลงเวลาครบแล้ววันนี้
          </div>
        ) : hasIn ? (
          <Button
            size="lg"
            className="h-14 w-full gap-2 rounded-2xl bg-white text-base font-semibold text-slate-900 hover:bg-slate-100"
            disabled={checking}
            onClick={() => (moodOpen ? setMoodOpen(false) : requestPhoto("out"))}
          >
            {checking ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />} เช็คเอาท์
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-14 w-full gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            disabled={checking}
            onClick={() => requestPhoto("in")}
          >
            {checking ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />} เช็คอิน
          </Button>
        )}

        {/* Map confirmation — only for ONSITE with a configured geofence */}
        {mapPreview && (
          <div className="space-y-3 rounded-2xl bg-white/5 p-3">
            <p className="text-center text-xs text-slate-300">ยืนยันตำแหน่งของคุณก่อน{mapPreview.kind === "in" ? "เช็คอิน" : "เช็คเอาท์"}</p>
            {branch?.lat != null && branch?.lng != null && branch?.radiusMeters != null && (
              <GeofenceMap
                branchLat={branch.lat}
                branchLng={branch.lng}
                radiusMeters={branch.radiusMeters}
                userLat={mapPreview.coords.lat}
                userLng={mapPreview.coords.lng}
              />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-white/15 bg-transparent text-white hover:bg-white/10"
                disabled={checking}
                onClick={() => setMapPreview(null)}
              >
                ยกเลิก
              </Button>
              <Button type="button" className="flex-1" disabled={checking} onClick={confirmMapPreview}>
                {checking ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                ยืนยัน{mapPreview.kind === "in" ? "เช็คอิน" : "เช็คเอาท์"}
              </Button>
            </div>
          </div>
        )}

        {/* Mood picker — appears in place, tap an emoji to check out immediately */}
        {moodOpen && !mapPreview && (
          <div className="mt-3 rounded-2xl bg-white/5 p-3">
            <p className="mb-2 text-center text-xs text-slate-300">วันนี้เป็นอย่างไรบ้าง? (แตะเพื่อเช็คเอาท์)</p>
            <div className="flex items-center justify-between">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  disabled={checking}
                  onClick={() => startClockOut(m.value)}
                  className="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition hover:bg-white/10 active:scale-95 disabled:opacity-40"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-slate-400">{m.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={checking}
              onClick={() => startClockOut()}
              className="mt-2 w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              ข้ามและเช็คเอาท์เลย
            </button>
          </div>
        )}

        {!isLoading && !hasOut && !moodOpen && !mapPreview && (
          <>
            <p className="mt-2 text-center text-xs text-slate-400">
              {hasIn ? "แตะเพื่อเช็คเอาท์เมื่อเลิกงาน" : "แตะเพื่อเช็คอินเข้างานทันที"}
            </p>
            <button
              type="button"
              disabled={checking}
              onClick={() => setQrOpen(true)}
              className="mx-auto mt-2 flex items-center gap-1.5 text-xs text-slate-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-40"
            >
              <QrCode className="size-3.5" /> หรือสแกน QR ที่สาขา
            </button>
          </>
        )}
      </div>

      {/* Break toggle — only while clocked in, not yet clocked out */}
      {hasIn && !hasOut && (
        <div className="relative mt-3">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 w-full gap-2 rounded-xl border-white/15 bg-white/5 text-sm font-medium text-white hover:bg-white/10",
              onBreak && "border-warning/40 bg-warning/15 text-warning hover:bg-warning/20",
            )}
            disabled={startBreakMut.isPending || endBreakMut.isPending}
            onClick={toggleBreak}
          >
            {startBreakMut.isPending || endBreakMut.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Coffee className="size-4" />
            )}
            {onBreak ? "เลิกพัก" : "เริ่มพัก"}
          </Button>
        </div>
      )}

      {/* In / out summary */}
      <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
        <div>
          <p className="text-xs text-slate-400">เวลาเข้า</p>
          <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">{fmtTime(record?.clockInAt)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">เวลาออก</p>
          <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">{fmtTime(record?.clockOutAt)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">เวลาพัก</p>
          <p className="mt-0.5 font-mono text-lg font-medium tabular-nums">
            {onBreak
              ? "กำลังพัก"
              : record?.breakStartAt && record?.breakEndAt
                ? `${Math.round(
                    (new Date(record.breakEndAt).getTime() - new Date(record.breakStartAt).getTime()) / 60000,
                  )} นาที`
                : "--:--"}
          </p>
        </div>
      </div>

      {/* Auto-opened on every clock-in/out tap — photo is still optional (skippable) */}
      <Dialog open={photoOpen} onOpenChange={(v) => (v ? setPhotoOpen(true) : skipPhoto())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ถ่ายรูปยืนยันตัวตน</DialogTitle>
            <DialogDescription>ใช้สำหรับยืนยันตัวตนเพิ่มเติม — ข้ามได้หากไม่สะดวก</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {!camReady && !camError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                <Loader2 className="mr-2 size-4 animate-spin" /> กำลังเปิดกล้อง…
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center text-xs text-slate-300">
                <AlertTriangle className="size-5 text-warning" /> เปิดกล้องไม่ได้
              </div>
            )}
            <button
              type="button"
              onClick={skipPhoto}
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white"
              aria-label="ปิด"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <Button type="button" className="w-full" onClick={capture} disabled={!camReady}>
            <Camera className="size-4" /> ถ่ายรูป
          </Button>
          <button
            type="button"
            onClick={skipPhoto}
            className="text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            ข้ามการถ่ายรูป
          </button>
        </DialogContent>
      </Dialog>

      {/* QR check-in/out — scans the branch's posted QR code instead of GPS */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>สแกน QR เพื่อ{hasIn ? "เช็คเอาท์" : "เช็คอิน"}</DialogTitle>
            <DialogDescription>เล็งกล้องไปที่ QR ของสาขาที่ติดไว้หน้างาน</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
            <video ref={qrVideoRef} playsInline muted className="size-full object-cover" />
            {!qrReady && !qrError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                <Loader2 className="mr-2 size-4 animate-spin" /> กำลังเปิดกล้อง…
              </div>
            )}
            {qrError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center text-xs text-slate-300">
                <AlertTriangle className="size-5 text-warning" /> เปิดกล้องไม่ได้ — กรุณาอนุญาตการเข้าถึงกล้อง
              </div>
            )}
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white"
              aria-label="ปิด"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Off-site fallback — only appears when the server actually rejects the location */}
      <Dialog open={!!offsite} onOpenChange={(v) => !v && setOffsite(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" /> อยู่นอกพื้นที่ทำงาน
            </DialogTitle>
            <DialogDescription>
              {offsite?.branchName ? `${offsite.branchName} — ` : ""}ห่าง {offsite?.distance.toLocaleString()} เมตร ระบุเหตุผลเพื่อลงเวลานอกสถานที่
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={2}
            autoFocus
            value={offsiteReason}
            onChange={(e) => setOffsiteReason(e.target.value)}
            placeholder="เช่น ออกพบลูกค้า / ส่งของนอกสถานที่ / ทำงานไซต์งาน"
          />
          <Button type="button" className="w-full" onClick={confirmOffsite} disabled={checking}>
            {checking ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} ยืนยันลงเวลานอกสถานที่
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
