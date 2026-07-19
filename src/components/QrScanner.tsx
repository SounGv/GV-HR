"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

interface BarcodeDetectorResult {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [supported] = useState(() => typeof window !== "undefined" && !!window.BarcodeDetector);

  useEffect(() => {
    if (!supported) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              onScan(results[0].rawValue);
              return;
            }
          } catch {
            // detection errors are transient (e.g. video not ready yet) — keep polling
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setError("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้กล้อง หรือกรอกรหัสด้วยตนเอง"));

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  if (!supported || error) {
    return (
      <div style={{ padding: "0 0 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 9,
            background: "#f5f6fa",
            borderRadius: 12,
            padding: "11px 13px",
            marginBottom: 12,
          }}
        >
          <Icon name="info" size={18} style={{ color: "#8a8d99" }} />
          <div style={{ fontSize: 11, color: "#7b7d8c", lineHeight: 1.5 }}>
            {error || "เบราว์เซอร์นี้ไม่รองรับการสแกน QR อัตโนมัติ กรอกรหัสสถานที่จากป้าย QR แทนได้"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="กรอกรหัส QR เช่น GVHR-xxxxxx"
            style={{
              flex: 1,
              padding: 12,
              border: "1.5px solid #e2e3ea",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          <button
            onClick={() => manualCode && onScan(manualCode.trim())}
            disabled={!manualCode}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "0 18px",
              fontFamily: "inherit",
              fontWeight: 800,
              background: manualCode ? "#17181c" : "#e6e7ec",
              color: manualCode ? "#c0e51f" : "#a3a6b2",
              cursor: manualCode ? "pointer" : "default",
            }}
          >
            ยืนยัน
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        height: 200,
        borderRadius: 20,
        background: "#17181c",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
      />
      <div style={{ position: "absolute", top: 14, left: 14, width: 34, height: 34, borderTop: "3px solid #c0e51f", borderLeft: "3px solid #c0e51f", borderRadius: "6px 0 0 0" }} />
      <div style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderTop: "3px solid #c0e51f", borderRight: "3px solid #c0e51f", borderRadius: "0 6px 0 0" }} />
      <div style={{ position: "absolute", bottom: 14, left: 14, width: 34, height: 34, borderBottom: "3px solid #c0e51f", borderLeft: "3px solid #c0e51f", borderRadius: "0 0 0 6px" }} />
      <div style={{ position: "absolute", bottom: 14, right: 14, width: 34, height: 34, borderBottom: "3px solid #c0e51f", borderRight: "3px solid #c0e51f", borderRadius: "0 0 6px 0" }} />
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          height: 3,
          background: "#c0e51f",
          boxShadow: "0 0 12px #c0e51f",
          borderRadius: 2,
          animation: "gvscan 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}
