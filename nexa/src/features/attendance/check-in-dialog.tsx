"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, MapPin, Loader2, LogIn, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCurrentPosition } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useClockIn, useClockOut } from "./hooks";

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

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

  // Acquire GPS + camera whenever the dialog opens; release on close.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setCoords(null);
    setGpsState("loading");
    setPhoto(null);
    setCamReady(false);
    setCamError(false);

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

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
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
  }, [open]);

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
    setSubmitting(true);
    try {
      const payload = {
        lat: coords?.lat,
        lng: coords?.lng,
        accuracy: coords?.accuracy,
        photo: photo ?? undefined,
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
      };
      if (kind === "in") await clockIn.mutateAsync(payload);
      else await clockOut.mutateAsync(payload);
      toast.success(kind === "in" ? "เช็คอินสำเร็จ" : "เช็คเอาท์สำเร็จ");
      onOpenChange(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "ลงเวลาไม่สำเร็จ");
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

          <div className="flex justify-center">
            {photo ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setPhoto(null)}>
                <RefreshCw className="size-4" /> ถ่ายใหม่
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={capture} disabled={!camReady}>
                <Camera className="size-4" /> ถ่ายรูป
              </Button>
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

          <Button type="button" className="w-full" onClick={submit} disabled={submitting || gpsState === "loading"}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            ยืนยัน{kind === "in" ? "เช็คอิน" : "เช็คเอาท์"}
          </Button>
          {!photo && !camError && (
            <p className="text-center text-xs text-muted-foreground">แนะนำให้ถ่ายรูปก่อนยืนยัน</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
