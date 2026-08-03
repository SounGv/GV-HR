"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, MapPin, Loader2, LogIn, LogOut, CheckCircle2, AlertTriangle, SwitchCamera, Home, Building2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getCurrentPosition } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useClockIn, useClockOut } from "./hooks";
import type { AttendanceMood, AttendanceWorkMode } from "./types";

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

const MOOD_OPTIONS: { value: AttendanceMood; emoji: string; label: string }[] = [
  { value: "TERRIBLE", emoji: "😣", label: "Terrible" },
  { value: "BAD", emoji: "🙁", label: "Bad" },
  { value: "OK", emoji: "🙂", label: "OK" },
  { value: "GOOD", emoji: "😊", label: "Good" },
  { value: "EXCELLENT", emoji: "😄", label: "Excellent" },
];

export function CheckInDialog({
  open,
  onOpenChange,
  kind,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: "in" | "out";
  onDone?: () => void;
}) {
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsState, setGpsState] = useState<"loading" | "ok" | "error">("loading");
  const [gpsMsg, setGpsMsg] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  // Off-site: revealed after the server rejects an out-of-geofence check-in. The
  // employee explains why (e.g. field work) and re-submits.
  const [offsite, setOffsite] = useState<{ distance: number; branchName: string | null } | null>(null);
  const [offsiteReason, setOffsiteReason] = useState("");
  const [workMode, setWorkMode] = useState<AttendanceWorkMode>("ONSITE");
  const [mood, setMood] = useState<AttendanceMood | null>(null);

  // GPS: acquire on open, reset photo.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCoords(null);
    setGpsState("loading");
    setPhoto(null);
    setOffsite(null);
    setOffsiteReason("");
    setWorkMode("ONSITE");
    setMood(null);
    getCurrentPosition()
      .then((pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsState("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setGpsState("error");
        setGpsMsg(e instanceof Error ? e.message : "ระบุตำแหน่งไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Camera: (re)acquire on open or when the user flips front/back.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCamReady(false);
    setCamError(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
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
  }, [open, facing]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const side = Math.min(video.videoWidth, video.videoHeight) || 480;
    const target = 480;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, target, target);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
  }

  async function submit() {
    // If we're in the off-site flow, a reason is required before re-submitting.
    if (offsite && !offsiteReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการทำงานนอกสถานที่");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        photo: photo ?? undefined,
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
        offsiteReason: offsiteReason.trim() || undefined,
        ...(kind === "in" ? { workMode } : {}),
        ...(kind === "out" && mood ? { mood } : {}),
      };
      if (kind === "in") await clockIn.mutateAsync(payload);
      else await clockOut.mutateAsync(payload);
      toast.success(kind === "in" ? "เช็คอินสำเร็จ" : "เช็คเอาท์สำเร็จ");
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      // Outside the geofence → reveal the off-site reason field instead of failing.
      const details = err instanceof ApiError ? (err.details as { offsite?: boolean; distance?: number; branchName?: string | null } | undefined) : undefined;
      if (details?.offsite) {
        setOffsite({ distance: details.distance ?? 0, branchName: details.branchName ?? null });
        toast.warning("อยู่นอกพื้นที่ทำงาน — กรุณาระบุเหตุผลเพื่อลงเวลานอกสถานที่");
      } else {
        toast.error(err instanceof ApiError || err instanceof Error ? err.message : "ลงเวลาไม่สำเร็จ");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const Icon = kind === "in" ? LogIn : LogOut;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" /> {kind === "in" ? "เช็คอินเข้างาน" : "เช็คเอาท์ออกงาน"}
          </DialogTitle>
          <DialogDescription>ถ่ายรูปยืนยันตัวตน และยืนยันตำแหน่ง GPS</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Work mode: WFH skips the branch geofence requirement */}
          {kind === "in" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorkMode("ONSITE")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition",
                  workMode === "ONSITE"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Building2 className="size-4" /> GPS (เข้าสำนักงาน)
              </button>
              <button
                type="button"
                onClick={() => setWorkMode("WFH")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition",
                  workMode === "WFH"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Home className="size-4" /> WFH
              </button>
            </div>
          )}

          {/* Camera / photo */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="selfie" className="size-full object-cover" />
            ) : (
              <video ref={videoRef} playsInline muted className="size-full object-cover" />
            )}
            {!photo && !camReady && !camError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
                <Loader2 className="mr-2 size-4 animate-spin" /> กำลังเปิดกล้อง…
              </div>
            )}
            {camError && !photo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center text-xs text-slate-300">
                <AlertTriangle className="size-5 text-warning" />
                เปิดกล้องไม่ได้ — ลงเวลาได้โดยไม่มีรูป
              </div>
            )}
          </div>

          <div className="flex justify-center gap-2">
            {photo ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setPhoto(null)}>
                <RefreshCw className="size-4" /> ถ่ายใหม่
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" onClick={capture} disabled={!camReady}>
                  <Camera className="size-4" /> ถ่ายรูป
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                  disabled={!camReady}
                >
                  <SwitchCamera className="size-4" /> สลับกล้อง
                </Button>
              </>
            )}
          </div>

          {/* GPS + live map */}
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              {gpsState === "loading" && <span className="text-muted-foreground">กำลังระบุตำแหน่ง…</span>}
              {gpsState === "ok" && coords && (
                <span className="text-foreground">
                  ตำแหน่งพร้อม · ความแม่นยำ ±{Math.round(coords.accuracy ?? 0)} ม.
                </span>
              )}
              {gpsState === "error" && <span className="text-warning">{gpsMsg}</span>}
            </div>
            {kind === "in" && workMode === "WFH" && (
              <p className="mt-1 text-xs text-muted-foreground">โหมด WFH — ไม่ต้องอยู่ในพื้นที่สาขา</p>
            )}
            {gpsState === "ok" && coords && (
              <iframe
                title="ตำแหน่งของฉัน"
                className="mt-2 h-40 w-full rounded-lg border border-border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=17&output=embed`}
              />
            )}
          </div>

          {/* Wellbeing check-in at clock-out */}
          {kind === "out" && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-center text-sm font-medium text-foreground">วันนี้เป็นอย่างไรบ้าง?</p>
              <div className="flex items-center justify-between">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition",
                      mood === m.value ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Off-site: shown after the server flags an out-of-geofence check-in */}
          {offsite && (
            <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
              <div className="flex items-start gap-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  อยู่นอกพื้นที่ทำงาน{offsite.branchName ? ` (${offsite.branchName})` : ""} — ห่าง{" "}
                  {offsite.distance.toLocaleString()} เมตร ระบุเหตุผลการทำงานนอกสถานที่เพื่อลงเวลา
                </span>
              </div>
              <Textarea
                rows={2}
                autoFocus
                value={offsiteReason}
                onChange={(e) => setOffsiteReason(e.target.value)}
                placeholder="เช่น ออกพบลูกค้า / ส่งของนอกสถานที่ / ทำงานไซต์งาน"
              />
            </div>
          )}

          <Button type="button" className="w-full" onClick={submit} disabled={submitting || gpsState === "loading"}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {offsite
              ? `ยืนยันลงเวลานอกสถานที่`
              : `ยืนยัน${kind === "in" ? "เช็คอิน" : "เช็คเอาท์"}`}
          </Button>
          {!photo && !camError && (
            <p className="text-center text-xs text-muted-foreground">แนะนำให้ถ่ายรูปก่อนยืนยัน</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
