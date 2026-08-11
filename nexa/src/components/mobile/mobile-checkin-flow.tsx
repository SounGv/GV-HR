"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, CheckCircle2, ChevronLeft, Loader2, MapPinned, RotateCcw, SwitchCamera, X, Zap, ZapOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentPosition, distanceMeters } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useCameraStream, type CameraFacing } from "@/features/attendance/use-camera-stream";
import { useClockIn, useClockOut, useToday } from "@/features/attendance/hooks";

type Step = "camera" | "preview" | "processing" | "offsite" | "success" | "error";

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

const STEPS = [
  { key: "camera", label: "กล้อง" },
  { key: "preview", label: "ยืนยัน" },
  { key: "gps", label: "GPS" },
  { key: "save", label: "บันทึก" },
] as const;

/**
 * Full-screen check-in/out wizard for phones — the ONLY way employees check
 * in/out on mobile. Reuses the exact same data layer as the desktop
 * ClockCard (useClockIn/useClockOut, useCameraStream, getCurrentPosition,
 * ApiError.details.offsite handling) so the underlying business logic and
 * API are unchanged; only the presentation is mobile-specific — one linear
 * camera → confirm → GPS/save → success flow, no break/mood/QR controls.
 */
export function MobileCheckinFlow({
  mode,
  skipCapture,
  onClose,
  onDone,
}: {
  mode: "in" | "out";
  skipCapture?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: todayData } = useToday();
  const clockIn = useClockIn();
  const clockOut = useClockOut();

  const [step, setStep] = useState<Step>(skipCapture ? "processing" : "camera");
  const [saveStage, setSaveStage] = useState<"gps" | "save">("gps");
  const [photo, setPhoto] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [offsiteInfo, setOffsiteInfo] = useState<{ distance: number; branchName: string | null; permitted: boolean } | null>(null);
  const [offsiteReason, setOffsiteReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultRecord, setResultRecord] = useState<{
    clockInAt: string | null;
    clockOutAt: string | null;
    clockInDistance: number | null;
    clockOutDistance: number | null;
  } | null>(null);

  const [facing, setFacing] = useState<CameraFacing>("user");
  const cam = useCameraStream(step === "camera" && !skipCapture, facing);
  const submittingRef = useRef(false);

  const branch = todayData?.data?.branch ?? null;
  const hasGeofence = branch?.lat != null && branch?.lng != null && branch?.radiusMeters != null;

  // Prime GPS as soon as the wizard opens (parallel with the camera), so
  // it's usually ready by the time the employee confirms their photo.
  useEffect(() => {
    if (skipCapture) return;
    let cancelled = false;
    getCurrentPosition()
      .then((pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      })
      .catch((e) => {
        if (!cancelled) setGpsError(e instanceof Error ? e.message : "ระบุตำแหน่งไม่สำเร็จ");
      });
    return () => {
      cancelled = true;
    };
  }, [skipCapture]);

  useEffect(() => {
    const track = cam.streamRef.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    setTorchSupported(!!caps?.torch);
  }, [cam.ready, cam.streamRef]);

  async function toggleTorch() {
    const track = cam.streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // Best-effort only — some browsers advertise the capability but reject it.
    }
  }

  function capture() {
    const video = cam.videoRef.current;
    if (!video || !video.videoWidth) return;
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 480, 480);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    setStep("preview");
  }

  async function submit(reason?: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStep("processing");
    setSaveStage("gps");
    setSubmitError(null);

    let point = coords;
    if (!point && !skipCapture && !reason) {
      try {
        const pos = await getCurrentPosition();
        point = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setCoords(point);
      } catch (e) {
        setGpsError(e instanceof Error ? e.message : "ระบุตำแหน่งไม่สำเร็จ");
      }
    }

    setSaveStage("save");
    const payload = {
      lat: point?.lat,
      lng: point?.lng,
      accuracy: point?.accuracy,
      photo: photo ?? undefined,
      offsiteReason: reason,
      workMode: skipCapture ? ("WFH" as const) : undefined,
      device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 380) : undefined,
    };

    try {
      const res = mode === "in" ? await clockIn.mutateAsync(payload) : await clockOut.mutateAsync(payload);
      setResultRecord(res.data);
      setOffsiteInfo(null);
      setStep("success");
    } catch (err) {
      const details =
        err instanceof ApiError
          ? (err.details as { offsite?: boolean; permitted?: boolean; distance?: number; branchName?: string | null } | undefined)
          : undefined;
      if (details?.offsite) {
        setOffsiteInfo({ distance: details.distance ?? 0, branchName: details.branchName ?? null, permitted: details.permitted ?? true });
        setStep("offsite");
      } else {
        setSubmitError(err instanceof ApiError || err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่");
        setStep("error");
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function confirmOffsite() {
    if (!offsiteReason.trim()) return;
    submit(offsiteReason.trim());
  }

  const title = mode === "in" ? "เช็คอิน" : "เช็คเอาท์";
  const activeStepIndex = step === "camera" ? 0 : step === "preview" ? 1 : step === "processing" ? (saveStage === "gps" ? 2 : 3) : 3;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d1108] text-white md:hidden">
      {step !== "success" && step !== "offsite" && (
        <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 text-sm text-slate-300"
              aria-label="ยกเลิก"
            >
              <ChevronLeft className="size-4" /> ยกเลิก
            </button>
            <p className="text-sm font-semibold">{title}</p>
            <span className="w-12" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-semibold transition",
                    i < activeStepIndex
                      ? "bg-primary text-[#14180c]"
                      : i === activeStepIndex
                        ? "bg-primary text-[#14180c] ring-4 ring-primary/20"
                        : "bg-white/10 text-white/40",
                  )}
                >
                  {i < activeStepIndex ? <Check className="size-3.5" /> : i + 1}
                </span>
                {i < STEPS.length - 1 && <span className="h-px w-4 bg-white/15" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "camera" && (
        <CameraStep
          videoRef={cam.videoRef}
          ready={cam.ready}
          error={cam.error}
          errorMessage={cam.errorMessage}
          facing={facing}
          onSwitchCamera={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          torchOn={torchOn}
          torchSupported={torchSupported}
          onToggleTorch={toggleTorch}
          onCapture={capture}
          onSkip={() => submit()}
          branchName={branch?.name ?? null}
          hasGeofence={hasGeofence}
          coords={coords}
          gpsError={gpsError}
          distance={
            coords && hasGeofence ? distanceMeters(coords.lat, coords.lng, branch!.lat!, branch!.lng!) : null
          }
        />
      )}

      {step === "preview" && photo && (
        <PreviewStep photo={photo} onRetake={() => setStep("camera")} onConfirm={() => submit()} />
      )}

      {step === "processing" && <ProcessingStep stage={saveStage} />}

      {step === "offsite" && offsiteInfo && (
        <OffsiteStep
          info={offsiteInfo}
          reason={offsiteReason}
          onReasonChange={setOffsiteReason}
          onCancel={onClose}
          onConfirm={confirmOffsite}
          pending={clockIn.isPending || clockOut.isPending}
        />
      )}

      {step === "error" && (
        <ErrorStep message={submitError} onRetry={() => setStep(skipCapture ? "processing" : photo ? "preview" : "camera")} onCancel={onClose} />
      )}

      {step === "success" && (
        <SuccessStep
          mode={mode}
          record={resultRecord}
          photo={photo}
          branchName={branch?.name ?? null}
          coords={coords}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function CameraStep({
  videoRef,
  ready,
  error,
  errorMessage,
  facing,
  onSwitchCamera,
  torchOn,
  torchSupported,
  onToggleTorch,
  onCapture,
  onSkip,
  branchName,
  hasGeofence,
  coords,
  gpsError,
  distance,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ready: boolean;
  error: boolean;
  errorMessage: string | null;
  facing: CameraFacing;
  onSwitchCamera: () => void;
  torchOn: boolean;
  torchSupported: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  onSkip: () => void;
  branchName: string | null;
  hasGeofence: boolean;
  coords: Coords | null;
  gpsError: string | null;
  distance: number | null;
}) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")}
      />
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-300">
          <Loader2 className="size-6 animate-spin" /> กำลังเปิดกล้อง…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="size-8 text-warning" />
          <p className="text-sm text-slate-200">{errorMessage ?? "เปิดกล้องไม่ได้"}</p>
          <button type="button" onClick={onSkip} className="mt-2 text-xs text-slate-400 underline underline-offset-2">
            ข้ามขั้นตอนถ่ายรูปแล้วลงเวลาต่อ
          </button>
        </div>
      )}
      {ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-64 rounded-[40%] border-2 border-white/70" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-10 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="mx-auto mb-4 flex max-w-xs items-center justify-between gap-2 rounded-xl bg-black/40 px-3 py-2 text-xs backdrop-blur">
          <span className="flex items-center gap-1.5 text-slate-200">
            <MapPinned className={cn("size-3.5 shrink-0", coords ? "text-primary" : "text-warning")} />
            {branchName ?? "ไม่ระบุสาขา"}
          </span>
          <span className={cn("shrink-0", coords ? "text-primary" : gpsError ? "text-warning" : "text-slate-300")}>
            {coords
              ? hasGeofence && distance != null
                ? `ห่าง ${Math.round(distance).toLocaleString()} ม.`
                : "GPS พร้อม"
              : gpsError
                ? "หาตำแหน่งไม่ได้"
                : "กำลังหาตำแหน่ง…"}
          </span>
        </div>

        <p className="mb-3 text-center text-xs text-slate-300">จัดใบหน้าให้อยู่ในกรอบ แล้วกดถ่ายรูป</p>

        <div className="flex items-center justify-center gap-8">
          {torchSupported ? (
            <button
              type="button"
              onClick={onToggleTorch}
              className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="เปิดแฟลช"
            >
              {torchOn ? <Zap className="size-5 text-primary" /> : <ZapOff className="size-5" />}
            </button>
          ) : (
            <span className="size-11" />
          )}
          <button
            type="button"
            onClick={onCapture}
            disabled={!ready}
            className="flex size-18 items-center justify-center rounded-full bg-white ring-4 ring-white/30 active:scale-95 disabled:opacity-40"
            aria-label="ถ่ายรูป"
          >
            <Camera className="size-7 text-[#14180c]" />
          </button>
          <button
            type="button"
            onClick={onSwitchCamera}
            className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="สลับกล้องหน้า/หลัง"
          >
            <SwitchCamera className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({ photo, onRetake, onConfirm }: { photo: string; onRetake: () => void; onConfirm: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="รูปถ่ายยืนยันตัวตน" className="size-full object-cover" />
      </div>
      <div className="px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-center">
        <p className="mb-4 text-xs text-slate-300">ตรวจสอบรูปให้ชัดเจน แล้วกด &quot;ใช้รูปนี้&quot;</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold text-white"
          >
            <RotateCcw className="size-4" /> ถ่ายใหม่
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-[#14180c]"
          >
            <Check className="size-4" /> ใช้รูปนี้
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessingStep({ stage }: { stage: "gps" | "save" }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <Loader2 className="size-9 animate-spin text-primary" />
      <p className="text-sm text-slate-200">{stage === "gps" ? "กำลังตรวจสอบตำแหน่ง…" : "กำลังบันทึกเวลา…"}</p>
    </div>
  );
}

function OffsiteStep({
  info,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  pending,
}: {
  info: { distance: number; branchName: string | null; permitted: boolean };
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle className="size-7" />
      </div>
      <p className="text-center text-base font-semibold">อยู่นอกพื้นที่ทำงาน</p>
      <p className="mt-1 text-center text-sm text-slate-300">
        {info.branchName ? `${info.branchName} — ` : ""}ห่าง {info.distance.toLocaleString()} เมตร
      </p>

      {info.permitted ? (
        <>
          <p className="mt-4 text-xs text-slate-400">หมายเหตุ</p>
          <textarea
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="เช่น ไปพบลูกค้า / ปฏิบัติงานนอกสถานที่"
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-13 flex-1 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!reason.trim() || pending}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-[#14180c] disabled:opacity-40"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} ยืนยันเช็คอิน
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-center text-sm font-medium text-warning">คุณไม่มีสิทธิ์เช็คอินนอกพื้นที่บริษัท</p>
          <p className="mt-1 text-center text-xs text-slate-400">
            หากจำเป็นต้องทำงานนอกสถานที่เป็นประจำ กรุณาติดต่อ HR เพื่อขอสิทธิ์
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 flex h-13 w-full items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white"
          >
            กลับหน้าหลัก
          </button>
        </>
      )}
    </div>
  );
}

function ErrorStep({ message, onRetry, onCancel }: { message: string | null; onRetry: () => void; onCancel: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="size-7" />
      </div>
      <p className="text-sm text-slate-200">{message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"}</p>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white">
          ยกเลิก
        </button>
        <button type="button" onClick={onRetry} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[#14180c]">
          ลองใหม่
        </button>
      </div>
    </div>
  );
}

function SuccessStep({
  mode,
  record,
  photo,
  branchName,
  coords,
  onDone,
}: {
  mode: "in" | "out";
  record: {
    clockInAt: string | null;
    clockOutAt: string | null;
    clockInDistance: number | null;
    clockOutDistance: number | null;
  } | null;
  photo: string | null;
  branchName: string | null;
  coords: Coords | null;
  onDone: () => void;
}) {
  const fmtTime = (iso: string | null | undefined) =>
    iso
      ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso))
      : "--:--";
  const fmtDate = () =>
    new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
  const time = mode === "in" ? record?.clockInAt : record?.clockOutAt;
  const distance = mode === "in" ? record?.clockInDistance : record?.clockOutDistance;
  const worked =
    record?.clockInAt && record?.clockOutAt
      ? (() => {
          const mins = Math.round((new Date(record.clockOutAt!).getTime() - new Date(record.clockInAt!).getTime()) / 60000);
          return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
        })()
      : "-";

  return (
    <div className="flex flex-1 flex-col bg-[#7ABE36] px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 className="size-9" />
        </div>
        <p className="mt-4 text-lg font-semibold">{mode === "in" ? "เช็คอินสำเร็จ" : "เช็คเอาท์สำเร็จ"}</p>
        <p className="mt-1 text-sm text-white/85">
          {fmtTime(time)} น. · {fmtDate()}
        </p>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-4 text-[#14180c]">
        <Row label="สถานที่" value={branchName ?? "-"} />
        <Row label="ระยะห่าง" value={distance != null ? `${Math.round(distance).toLocaleString()} เมตร` : "-"} />
        <Row label="พิกัด" value={coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "-"} />
        {photo && (
          <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-3">
            <span className="text-xs text-muted-foreground">รูปถ่าย</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="size-11 rounded-lg object-cover" />
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 border-t border-black/5 pt-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">เวลาเข้า</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{fmtTime(record?.clockInAt)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">เวลาออก</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{fmtTime(record?.clockOutAt)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">เวลาทำงาน</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{worked}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-5 flex h-13 w-full items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#14180c]"
      >
        กลับหน้าหลัก
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
