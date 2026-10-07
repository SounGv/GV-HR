"use client";

import { useEffect, useRef, useState } from "react";

export type CameraFacing = "user" | "environment";

/**
 * Shared getUserMedia lifecycle for both the identity-photo capture and the
 * QR scanner — opens/closes the stream as `active` toggles and re-requests
 * it whenever `facing` changes (front/back camera switch), attaching to
 * `videoRef` automatically. Permission/hardware failures are surfaced as a
 * Thai message with next-step guidance rather than a bare "camera failed".
 *
 * `sharp` asks for a 1080p stream and continuous autofocus, for screens that
 * keep the photo; the default stays lighter for the QR scanner.
 */
export function useCameraStream(active: boolean, facing: CameraFacing, options?: { sharp?: boolean }) {
  const sharp = options?.sharp ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setReady(false);
    setError(false);
    setErrorMessage(null);
    (async () => {
      try {
        // Without explicit resolution constraints, some browsers/devices
        // negotiate a low-res stream (e.g. 640x480) by default — the capture
        // canvas then has nothing sharper to draw from no matter how it's
        // downscaled, which is what actually caused blurry check-in photos.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: sharp
            ? { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (sharp) {
          // Keep re-focusing while the phone moves instead of locking on the
          // first frame. Best-effort: browsers without focus control ignore it.
          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
          if (caps?.focusMode?.includes("continuous")) {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
          }
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(true);
        const name = e instanceof DOMException ? e.name : "";
        setErrorMessage(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "ไม่ได้รับอนุญาตให้เข้าถึงกล้อง — เปิดสิทธิ์กล้องให้เว็บไซต์นี้ในตั้งค่าเบราว์เซอร์ (ไอคอนล็อค/กล้องข้างช่องที่อยู่เว็บ) แล้วลองใหม่"
            : name === "NotFoundError"
              ? "ไม่พบกล้องบนอุปกรณ์นี้"
              : "เปิดกล้องไม่ได้ — ตรวจสอบว่าไม่มีแอปอื่นกำลังใช้กล้องอยู่แล้วลองใหม่",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active, facing, sharp]);

  return { videoRef, streamRef, ready, error, errorMessage };
}
