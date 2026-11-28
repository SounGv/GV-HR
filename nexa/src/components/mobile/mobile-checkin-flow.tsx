"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, CheckCircle2, Loader2, MapPin, Maximize2, RotateCcw, SwitchCamera, X, Zap, ZapOff } from "lucide-react";
import { TileMap, type LatLng } from "@/components/shared/tile-map";
import { cn } from "@/lib/utils";
import { getCurrentPosition, distanceMeters } from "@/lib/geolocation";
import { ApiError } from "@/lib/api/client";
import { useCameraStream, type CameraFacing } from "@/features/attendance/use-camera-stream";
import { useClockIn, useClockOut, useToday } from "@/features/attendance/hooks";
import { useBackButton } from "@/hooks/use-back-button";

type Step = "map" | "camera" | "preview" | "processing" | "offsite" | "success" | "error";

interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Longest side of the saved photo; sharp enough to read, small enough to keep each photo near 150 KB. */
const PHOTO_MAX_SIDE = 1280;

const STEPS = [
  { key: "map", label: "ตำแหน่ง" },
  { key: "camera", label: "ถ่ายรูป" },
  { key: "preview", label: "ยืนยัน" },
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

  const [step, setStep] = useState<Step>(skipCapture ? "processing" : "map");
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
    status: string;
  } | null>(null);

  const [facing, setFacing] = useState<CameraFacing>("environment");
  const cam = useCameraStream(step === "camera" && !skipCapture, facing, { sharp: true });
  const submittingRef = useRef(false);

  // The phone's back button steps back through the flow (confirm -> camera -> map) and only from the first screen
  // closes it; it used to leave the app and throw the photo and location away. While saving it does nothing.
  useBackButton(true, () => {
    if (step === "preview") {
      setStep("camera");
      return "stay";
    }
    if (step === "camera") {
      setStep("map");
      return "stay";
    }
    if (step === "processing") return "stay";
    if (step === "success") onDone();
    else onClose();
    return "leave";
  });

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

  // Working from home has no photo or location step: record the time as soon as the wizard opens.
  useEffect(() => {
    if (skipCapture) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Save exactly what the full-screen viewfinder shows: the video fills the
    // screen with object-cover, so crop the frame to the screen's aspect ratio.
    const scale = Math.max(video.clientWidth / video.videoWidth, video.clientHeight / video.videoHeight);
    const cropW = video.clientWidth / scale;
    const cropH = video.clientHeight / scale;
    const cropX = (video.videoWidth - cropW) / 2;
    const cropY = (video.videoHeight - cropH) / 2;
    const shrink = Math.min(1, PHOTO_MAX_SIDE / Math.max(cropW, cropH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cropW * shrink);
    canvas.height = Math.round(cropH * shrink);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.8));
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
        // A dropped connection reaches here as a raw TypeError ("Failed to
        // fetch") — an English browser string that tells a warehouse worker
        // nothing. Say what happened and that the photo is still there.
        const offline =
          (typeof navigator !== "undefined" && navigator.onLine === false) ||
          (err instanceof TypeError && !(err instanceof ApiError));
        setSubmitError(
          offline
            ? "ไม่มีสัญญาณอินเทอร์เน็ต ยังไม่ได้บันทึกเวลา — รูปที่ถ่ายยังอยู่ กด “ลองใหม่” เมื่อสัญญาณกลับมา"
            : err instanceof ApiError || err instanceof Error
              ? err.message
              : "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
        );
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

  const title = mode === "in" ? "ลงเวลาเข้างาน" : "ลงเวลาออกงาน";
  const activeStepIndex = step === "map" ? 0 : step === "camera" ? 1 : step === "preview" ? 2 : 3;
  const onCamera = step === "camera" || step === "preview";
  const distance = coords && hasGeofence ? distanceMeters(coords.lat, coords.lng, branch!.lat!, branch!.lng!) : null;
  const geo: Geo = {
    branchName: branch?.name ?? null,
    branchAt: hasGeofence ? { lat: branch!.lat!, lng: branch!.lng! } : null,
    radius: branch?.radiusMeters ?? null,
    me: coords,
    distance,
    gpsError,
  };

  return (
    <div
      data-gv-fullscreen
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-hidden pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:hidden",
        onCamera ? "bg-[#0b1414] text-white" : "gv-lg-bg gv-login-scope text-foreground",
      )}
    >
      {(onCamera || step === "processing" || step === "error") && (
        <FlowHeader title={title} stepIndex={activeStepIndex} dark={onCamera} onClose={onClose} />
      )}

      {/* First screen: the whole map and one button. The camera only opens (and asks for permission) when the person presses it. */}
      {step === "map" && <FullMapView geo={geo} stepIndex={activeStepIndex} onClose={onClose} onNext={() => setStep("camera")} />}

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
          geo={geo}
          onOpenMap={() => setStep("map")}
        />
      )}

      {step === "preview" && photo && <PreviewStep photo={photo} onRetake={() => setStep("camera")} onConfirm={() => submit()} />}

      {step === "processing" && <ProcessingStep stage={saveStage} hasPhoto={!!photo} />}

      {step === "offsite" && offsiteInfo && (
        <OffsiteStep
          info={offsiteInfo}
          geo={geo}
          reason={offsiteReason}
          onReasonChange={setOffsiteReason}
          onCancel={onClose}
          onConfirm={confirmOffsite}
          pending={clockIn.isPending || clockOut.isPending}
          actionLabel={title}
        />
      )}

      {step === "error" && (
        <ErrorStep message={submitError} onRetry={() => (skipCapture ? void submit() : setStep(photo ? "preview" : "camera"))} onCancel={onClose} />
      )}

      {step === "success" && (
        <SuccessStep
          mode={mode}
          record={resultRecord}
          isLate={mode === "in" && resultRecord?.status === "LATE"}
          photo={photo}
          geo={geo}
          onDone={onDone}
        />
      )}
    </div>
  );
}

/** What the screens need to draw the map and the distance: the branch circle, where the phone is, and how far apart they are. */
interface Geo {
  branchName: string | null;
  branchAt: LatLng | null;
  radius: number | null;
  me: Coords | null;
  distance: number | null;
  gpsError: string | null;
}

const CAM_GLASS = "gv-lg-cam";

function FlowHeader({ title, stepIndex, dark, onClose }: { title: string; stepIndex: number; dark: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        "z-10 flex items-center gap-2.5 px-3.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] pb-2",
        dark ? "absolute inset-x-0 top-0" : "shrink-0 text-foreground",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="ยกเลิก"
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-95", dark ? CAM_GLASS : "gv-lg")}
      >
        <X className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] leading-snug font-bold">{title}</p>
        <p className={cn("text-xs", dark ? "text-white/85" : "text-muted-foreground")}>
          ขั้นที่ {stepIndex + 1} จาก {STEPS.length} {STEPS[stepIndex].label}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color]",
              i === stepIndex ? "w-[30px]" : "w-[18px]",
              i <= stepIndex ? (dark ? "bg-[#90caf9]" : "bg-primary") : dark ? "bg-white/35" : "bg-foreground/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** Both the branch circle and the person in view when they are known; otherwise whichever one exists. */
function mapProps(geo: Geo) {
  const center = geo.me && geo.branchAt ? { lat: (geo.me.lat + geo.branchAt.lat) / 2, lng: (geo.me.lng + geo.branchAt.lng) / 2 } : (geo.branchAt ?? geo.me);
  return {
    center,
    fitPoints: geo.me && geo.branchAt ? [geo.me, geo.branchAt] : undefined,
    fence: geo.branchAt && geo.radius != null ? { at: geo.branchAt, radius: geo.radius, outside: geo.distance != null && geo.distance > geo.radius } : undefined,
    pin: geo.branchAt ?? undefined,
    me: geo.me ?? undefined,
  };
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
  geo,
  onOpenMap,
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
  geo: Geo;
  onOpenMap: () => void;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <video ref={videoRef} playsInline muted className={cn("absolute inset-0 size-full object-cover", facing === "user" && "-scale-x-100")} />
      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-300">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" /> กำลังเปิดกล้อง…
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="size-8 text-amber-300" aria-hidden="true" />
          <p className="text-sm text-slate-200">{errorMessage ?? "เปิดกล้องไม่ได้"}</p>
          <button type="button" onClick={onSkip} className="mt-2 min-h-11 px-3 text-xs text-slate-300 underline underline-offset-2">
            ข้ามขั้นตอนถ่ายรูปแล้วลงเวลาต่อ
          </button>
        </div>
      )}

      {/* Corner marks to help line the face up; they only guide the eye, nothing checks the face. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-[54%] left-1/2 h-[230px] w-[250px] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute top-0 left-0 size-9 rounded-tl-[18px] border-t-[3px] border-l-[3px] border-[#90caf9]" />
        <span className="absolute top-0 right-0 size-9 rounded-tr-[18px] border-t-[3px] border-r-[3px] border-[#90caf9]" />
        <span className="absolute bottom-0 left-0 size-9 rounded-bl-[18px] border-b-[3px] border-l-[3px] border-[#90caf9]" />
        <span className="absolute right-0 bottom-0 size-9 rounded-br-[18px] border-r-[3px] border-b-[3px] border-[#90caf9]" />
      </div>

      <button
        type="button"
        onClick={onOpenMap}
        aria-label="กลับไปดูแผนที่"
        className={cn(CAM_GLASS, "absolute top-[calc(env(safe-area-inset-top)+4.75rem)] left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-sm px-4 text-sm font-semibold active:scale-95")}
      >
        {geo.distance != null && geo.radius != null ? (
          geo.distance <= geo.radius ? (
            <CheckCircle2 className="size-4 text-[#9ff0d3]" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4 text-[#ffd37a]" aria-hidden="true" />
          )
        ) : (
          <MapPin className="size-4" aria-hidden="true" />
        )}
        <span role="status" aria-live="polite">
          {geo.me
            ? geo.distance != null && geo.radius != null
              ? `ห่าง ${Math.round(geo.distance).toLocaleString("th-TH")} ม. ${geo.distance <= geo.radius ? "ในพื้นที่" : "นอกพื้นที่"}`
              : "GPS พร้อม"
            : geo.gpsError
              ? "หาตำแหน่งไม่ได้"
              : "กำลังหาตำแหน่ง…"}
        </span>
        <Maximize2 className="size-4 opacity-80" aria-hidden="true" />
      </button>

      <div className={cn(CAM_GLASS, "absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] z-10 rounded-lg px-4 pt-3.5 pb-4")}>
        <p className="mb-2.5 text-center text-[13px] text-white/90">ถือให้นิ่ง แล้วกดถ่ายรูป</p>
        <div className="flex items-center justify-center gap-8">
          {torchSupported ? (
            <button
              type="button"
              onClick={onToggleTorch}
              className={cn(CAM_GLASS, "flex size-11 items-center justify-center rounded-full")}
              aria-label="แฟลช"
              aria-pressed={torchOn}
            >
              {torchOn ? <Zap className="size-5 text-[#90caf9]" /> : <ZapOff className="size-5" />}
            </button>
          ) : (
            <span className="size-11" />
          )}
          <button
            type="button"
            onClick={onCapture}
            disabled={!ready}
            className="flex size-[78px] items-center justify-center rounded-full border-4 border-white bg-transparent transition active:scale-95 motion-reduce:active:scale-100 disabled:opacity-40"
            aria-label="ถ่ายรูป"
          >
            <span className="flex size-[60px] items-center justify-center rounded-full bg-white text-[#1565c0]">
              <Camera className="size-7" />
            </span>
          </button>
          <button type="button" onClick={onSwitchCamera} className={cn(CAM_GLASS, "flex size-11 items-center justify-center rounded-full")} aria-label="สลับกล้องหน้า/หลัง">
            <SwitchCamera className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** First screen of check-in: the whole map (drag to move, plus and minus to zoom), where the person is against the branch circle, and one button to take the photo. */
function FullMapView({ geo, stepIndex, onClose, onNext }: { geo: Geo; stepIndex: number; onClose: () => void; onNext: () => void }) {
  const mp = mapProps(geo);
  const inside = geo.distance != null && geo.radius != null ? geo.distance <= geo.radius : null;
  const warn = inside === false || !!geo.gpsError;
  return (
    <div className="absolute inset-0 text-foreground">
      {mp.center ? (
        <TileMap center={mp.center} zoom={18} fitPoints={mp.fitPoints} fence={mp.fence} pin={mp.pin} me={mp.me} insets={{ top: 80, bottom: 320 }} interactive className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 gv-lg-bg" />
      )}
      <div className="gv-lg absolute inset-x-3.5 top-[calc(env(safe-area-inset-top)+0.625rem)] z-10 flex items-center gap-2.5 rounded-sm py-1.5 pr-4 pl-1.5">
        <button type="button" onClick={onClose} aria-label="ยกเลิก" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--lg-glass-strong)] active:scale-95">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-bold">ตำแหน่งของคุณ</p>
          <p className="text-xs text-muted-foreground">
            ขั้นที่ {stepIndex + 1} จาก {STEPS.length} {STEPS[stepIndex].label}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.key} className={cn("h-1.5 rounded-full", i === stepIndex ? "w-[26px]" : "w-4", i <= stepIndex ? "bg-primary" : "bg-foreground/20")} />
          ))}
        </div>
      </div>
      <div className="gv-lg absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] z-10 rounded-lg px-[18px] pt-4 pb-[18px]">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full text-white ",
              warn ? "bg-[#b88200]" : "bg-[#1565c0]",
            )}
          >
            {warn ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </span>
          <div className="min-w-0" role="status" aria-live="polite">
            <p className="text-lg leading-snug font-bold">
              {geo.me ? (inside === false ? "อยู่นอกพื้นที่ทำงาน" : inside ? "อยู่ในพื้นที่ทำงาน" : "ได้ตำแหน่งแล้ว") : geo.gpsError ? "หาตำแหน่งไม่ได้" : "กำลังหาตำแหน่ง…"}
            </p>
            <p className="text-sm text-muted-foreground">
              {geo.branchName ?? "ไม่ระบุสาขา"}
              {geo.distance != null ? ` · ห่าง ${Math.round(geo.distance).toLocaleString("th-TH")} เมตร` : ""}
              {geo.radius != null ? ` · รัศมี ${Math.round(geo.radius).toLocaleString("th-TH")} ม.` : ""}
            </p>
          </div>
        </div>
        {(inside === false || geo.gpsError) && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {geo.gpsError
              ? "ถ่ายรูปต่อได้ ระบบจะลองหาตำแหน่งอีกครั้งตอนบันทึก"
              : "ถ่ายรูปต่อได้ ถ้า HR ให้สิทธิ์นอกสถานที่ ระบบจะให้กรอกเหตุผลหลังถ่ายรูป"}
          </p>
        )}
        <button type="button" onClick={onNext} autoFocus className={cn(PRIMARY_BTN, "mt-3 flex h-[56px] w-full items-center justify-center gap-2.5 text-[17px]")}>
          <Camera className="size-6" aria-hidden="true" /> ถ่ายรูปลงเวลาเข้างาน
        </button>
      </div>
    </div>
  );
}

const PRIMARY_BTN =
  "rounded bg-primary text-base font-bold text-white transition hover:bg-[#1565c0] active:scale-[0.99] disabled:opacity-40 dark:bg-[#42a5f5] dark:text-[#06182c] dark:hover:bg-[#64b5f6]";
const CAM_PRIMARY_BTN =
  "rounded bg-white text-[#0d47a1] font-bold transition active:scale-95 motion-reduce:active:scale-100";

function PreviewStep({ photo, onRetake, onConfirm }: { photo: string; onRetake: () => void; onConfirm: () => void }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* The saved photo has the same shape as the camera view, so it fills the screen edge to edge with nothing cut off. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="รูปถ่ายยืนยันตัวตน" className="absolute inset-0 size-full object-cover" />

      <div className={cn(CAM_GLASS, "absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] rounded-lg px-4 pt-3.5 pb-4")}>
        <p className="mb-3 text-center text-[15px] font-semibold text-white">ตรวจรูปให้ชัดก่อนยืนยัน</p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onRetake}
            className={cn(CAM_GLASS, "flex h-[58px] flex-1 flex-col items-center justify-center rounded text-sm font-semibold transition active:scale-95 motion-reduce:active:scale-100")}
          >
            <RotateCcw className="size-[18px]" aria-hidden="true" /> ถ่ายใหม่
          </button>
          <button type="button" onClick={onConfirm} className={cn(CAM_PRIMARY_BTN, "flex h-[58px] flex-[2.2] items-center justify-center gap-2 text-base")}>
            <Check className="size-5" aria-hidden="true" /> ใช้รูปนี้
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessingStep({ stage, hasPhoto }: { stage: "gps" | "save"; hasPhoto: boolean }) {
  const rows = [
    ...(hasPhoto ? [{ key: "photo", label: "ถ่ายรูปแล้ว", state: "done" as const }] : []),
    { key: "gps", label: "ตรวจสอบตำแหน่ง", state: stage === "gps" ? ("now" as const) : ("done" as const) },
    { key: "save", label: "บันทึกเวลา", state: stage === "save" ? ("now" as const) : ("wait" as const) },
  ];
  return (
    <div role="status" aria-live="polite" className="flex flex-1 items-center px-[18px] pb-16">
      <div className="gv-lg w-full rounded-lg px-[18px] py-6 text-center">
        <h2 className="text-[22px] leading-snug font-bold">{stage === "gps" ? "กำลังตรวจสอบตำแหน่ง" : "กำลังบันทึกเวลา"}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">รอสักครู่ ไม่ต้องปิดหน้านี้</p>
        <ol className="mt-4 grid gap-2.5 text-left">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-3 rounded-md border border-[var(--lg-edge)] bg-[var(--lg-glass-strong)] px-3 py-2.5 text-sm">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                  r.state === "done" && "bg-primary text-primary-foreground",
                  r.state === "wait" && "bg-accent text-primary",
                  r.state === "now" && "bg-accent text-primary",
                )}
              >
                {r.state === "done" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : r.state === "now" ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn(r.state === "wait" && "text-muted-foreground")}>{r.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function OffsiteStep({
  info,
  geo,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  pending,
  actionLabel,
}: {
  info: { distance: number; branchName: string | null; permitted: boolean };
  geo: Geo;
  /** "ลงเวลาเข้างาน" or "ลงเวลาออกงาน", for the confirm button. */
  actionLabel: string;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const mp = mapProps({ ...geo, distance: info.distance });
  return (
    <div role="alert" className="absolute inset-0">
      {mp.center ? (
        <TileMap center={mp.center} zoom={17} fitPoints={mp.fitPoints} fence={mp.fence ? { ...mp.fence, outside: true } : undefined} pin={mp.pin} me={mp.me} line={geo.me && geo.branchAt ? [geo.branchAt, geo.me] : undefined} insets={{ top: 100, bottom: 260 }} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 gv-lg-bg" />
      )}
      <div className="absolute inset-x-3.5 top-[calc(env(safe-area-inset-top)+0.625rem)]">
        <div className="gv-lg flex items-center gap-2.5 rounded-sm px-3.5 py-2">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#b88200] text-white ">
            <AlertTriangle className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-base leading-snug font-bold">อยู่นอกพื้นที่ทำงาน</p>
            <p className="truncate text-xs text-muted-foreground">
              {info.branchName ? `${info.branchName} ` : ""}ห่าง {info.distance.toLocaleString("th-TH")} เมตร
            </p>
          </div>
        </div>
      </div>

      <div className="gv-lg absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] rounded-lg px-[18px] pt-4 pb-[18px]">
        {info.permitted ? (
          <>
            <label htmlFor="offsite-reason" className="text-sm font-bold">
              เหตุผลที่อยู่นอกพื้นที่ (จำเป็น)
            </label>
            <textarea
              id="offsite-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="เช่น ไปพบลูกค้า / ปฏิบัติงานนอกสถานที่"
              className="mt-1.5 w-full rounded-md border-[1.5px] border-[var(--lg-field)] bg-[var(--lg-in)] p-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-2.5">
              <button type="button" onClick={onCancel} className="h-[54px] rounded border-[1.5px] border-[var(--lg-field)] bg-[var(--lg-in)] text-base font-bold text-foreground">
                ยกเลิก
              </button>
              <button type="button" onClick={onConfirm} disabled={!reason.trim() || pending} className={cn(PRIMARY_BTN, "flex h-[54px] items-center justify-center gap-2 text-[15px]")}>
                {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" /> : <Check className="size-4" />} ยืนยัน{actionLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-bold text-[#8a6100] dark:text-[#f5b700]">คุณยังไม่ได้รับสิทธิ์{actionLabel}นอกพื้นที่บริษัท</p>
            <p className="mt-1 text-sm text-muted-foreground">สิทธิ์นี้ HR เป็นผู้ติ๊กให้เป็นรายคน หากจำเป็นต้องทำงานนอกสถานที่ ติดต่อ HR เพื่อขอสิทธิ์</p>
            <button type="button" onClick={onCancel} className={cn(PRIMARY_BTN, "mt-3 h-[54px] w-full")}>
              กลับหน้าหลัก
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorStep({ message, onRetry, onCancel }: { message: string | null; onRetry: () => void; onCancel: () => void }) {
  return (
    <div role="alert" className="flex flex-1 items-center px-[18px] pb-16">
      <div className="gv-lg w-full rounded-lg px-[18px] py-6 text-center">
        <span className="mx-auto flex size-[68px] items-center justify-center rounded-full bg-[#b42318] text-white ">
          <X className="size-8" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-[22px] leading-snug font-bold">ลงเวลาไม่สำเร็จ</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message ?? "ตรวจสัญญาณอินเทอร์เน็ต แล้วกด ลองใหม่ ถ้ายังไม่ได้ แจ้ง HR"}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onCancel} className="h-[54px] rounded border-[1.5px] border-[var(--lg-field)] bg-[var(--lg-in)] text-base font-bold text-foreground">
            ยกเลิก
          </button>
          <button type="button" onClick={onRetry} className={cn(PRIMARY_BTN, "h-[54px]")}>
            ลองใหม่
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessStep({
  mode,
  record,
  isLate,
  photo,
  geo,
  onDone,
}: {
  mode: "in" | "out";
  record: {
    clockInAt: string | null;
    clockOutAt: string | null;
    clockInDistance: number | null;
    clockOutDistance: number | null;
  } | null;
  isLate?: boolean;
  photo: string | null;
  geo: Geo;
  onDone: () => void;
}) {
  const fmtTime = (iso: string | null | undefined) =>
    iso ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso)) : "--:--";
  const fmtDate = () => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date());
  const time = mode === "in" ? record?.clockInAt : record?.clockOutAt;
  const distance = mode === "in" ? record?.clockInDistance : record?.clockOutDistance;
  const worked =
    record?.clockInAt && record?.clockOutAt
      ? (() => {
          const mins = Math.round((new Date(record.clockOutAt!).getTime() - new Date(record.clockInAt!).getTime()) / 60000);
          return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
        })()
      : "-";
  const mp = mapProps(geo);
  // Show where the time was saved, not the distance guess from before the save.
  const where = geo.me ?? geo.branchAt;

  return (
    <div role="status" aria-live="polite" className="absolute inset-0">
      {where ? (
        <TileMap
          center={where}
          zoom={18}
          fence={mp.fence ? { ...mp.fence, outside: false } : undefined}
          pin={mp.pin}
          me={mp.me}
          insets={{ top: 60, bottom: 400 }}
          className="absolute inset-0"
        >
          <span className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 z-10 inline-flex min-h-[30px] items-center gap-1.5 rounded-sm bg-white/90 px-2.5 text-xs font-bold text-[#17774a] ">
            <CheckCircle2 className="size-4" aria-hidden="true" /> บันทึกที่จุดนี้ {fmtTime(time)}
          </span>
        </TileMap>
      ) : (
        <div className="gv-lg-bg absolute inset-0" />
      )}

      <div className="gv-lg absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.875rem)] rounded-lg px-[18px] pt-5 pb-[18px]">
        <div className="flex items-center gap-3">
          <span className="gv-confirm flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1565c0] text-white ">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-snug font-bold">{mode === "in" ? "ลงเวลาเข้างานแล้ว" : "ลงเวลาออกงานแล้ว"}</p>
            <p className="text-sm text-muted-foreground">
              {fmtDate()}
              {geo.branchName ? ` · ${geo.branchName}` : ""}
              {distance != null ? ` · ห่าง ${Math.round(distance).toLocaleString("th-TH")} เมตร` : ""}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[34px] leading-tight font-bold tabular-nums">
            {fmtTime(time)} <span className="text-base font-semibold">น.</span>
          </p>
          {isLate && <span className="rounded-sm bg-[#f5b700]/25 px-3 py-1 text-xs font-bold text-[#8a6100] dark:text-[#f5b700]">มาสาย</span>}
        </div>
        <dl className="mt-3 grid grid-cols-3 rounded-md border border-[var(--lg-edge)] bg-[var(--lg-glass-strong)] py-2.5 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">เวลาเข้า</dt>
            <dd className="font-mono text-[15px] font-bold tabular-nums">{fmtTime(record?.clockInAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">เวลาออก</dt>
            <dd className="font-mono text-[15px] font-bold tabular-nums">{fmtTime(record?.clockOutAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">เวลาทำงาน</dt>
            <dd className="font-mono text-[15px] font-bold tabular-nums">{worked}</dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="รูปที่ถ่าย" className="size-[58px] shrink-0 rounded-md object-cover" />
          )}
          <button type="button" onClick={onDone} className={cn(PRIMARY_BTN, "h-[58px] flex-1")}>
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}
