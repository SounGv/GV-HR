"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "./Icon";
import { QrScanner } from "./QrScanner";

const progressLabels = [
  "กำลังตรวจสอบ QR Code...",
  "กำลังรับตำแหน่งปัจจุบัน (GPS)...",
  "กำลังยืนยันสถานที่ทำงาน...",
  "กำลังคำนวณระยะทาง...",
  "กำลังตรวจสอบพื้นที่ลงเวลา...",
];

export function GpsSheet() {
  const { state, closeGps, confirmGps, setWorkplace, submitQrCode, retryGps } = useApp();
  const gps = state.gps;
  if (!gps) return null;

  const title = gps.mode === "out" ? "ลงเวลาออกงาน" : "ลงเวลาเข้างาน";
  const confirmLabel = gps.mode === "out" ? "ยืนยันลงเวลาออก" : "ยืนยันลงเวลาเข้า";
  const selectedWp = state.workplaces.find((w) => w.id === gps.workplaceId);

  const isQr = gps.phase === "qr";
  const isProgress = gps.phase === "progress";
  const isResult = gps.phase === "result";
  const verified = isResult && gps.verified;
  const rejected = isResult && !gps.verified;

  const empLeft = verified ? "58%" : "82%";
  const empTop = verified ? "42%" : "20%";
  const geoColor = verified ? "#0f9d6e" : "#e8590c";
  const geoFill = verified ? "rgba(15,157,110,.14)" : "rgba(232,89,12,.12)";

  return (
    <>
      <div
        onClick={closeGps}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,15,35,.55)",
          zIndex: 25,
          animation: "gvfade .2s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#fff",
          borderRadius: "28px 28px 0 0",
          zIndex: 26,
          padding: "8px 20px 26px",
          animation: "gvsheet .3s cubic-bezier(.2,.9,.3,1)",
          boxShadow: "0 -20px 50px -20px rgba(0,0,0,.4)",
          maxHeight: "92%",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 40, height: 5, background: "#e2e3ea", borderRadius: 99, margin: "6px auto 16px" }} />
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{title}</div>

        {isQr && (
          <>
            <div style={{ fontSize: 12, color: "#8a8d99", marginBottom: 14 }}>
              สแกน QR Code ณ จุดลงเวลา แล้วยืนยันตำแหน่งด้วย GPS
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
              {state.workplaces.map((w) => {
                const active = gps.workplaceId === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setWorkplace(w.id)}
                    style={{
                      flex: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 13px",
                      borderRadius: 999,
                      background: active ? "#17181c" : "#f5f6fa",
                      color: active ? "#c0e51f" : "#7b7d8c",
                    }}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
            <QrScanner onScan={submitQrCode} />
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                background: "#f5f6fa",
                borderRadius: 12,
                padding: "11px 13px",
                margin: "14px 0",
              }}
            >
              <Icon name="lock" size={18} style={{ color: "#8a8d99" }} />
              <div style={{ fontSize: 11, color: "#7b7d8c", lineHeight: 1.5 }}>
                ระบบขอตำแหน่งเฉพาะตอนลงเวลาเท่านั้น เพื่อยืนยันว่าคุณอยู่ที่ <b>{selectedWp?.name}</b> (รัศมี{" "}
                {selectedWp?.radiusMeters} ม.)
              </div>
            </div>
          </>
        )}

        {isProgress && (
          <>
            <div style={{ fontSize: 12, color: "#8a8d99", marginBottom: 8 }}>กำลังยืนยันการลงเวลา...</div>
            <div style={{ background: "#fff", borderRadius: 16, padding: "4px 4px", marginBottom: 8 }}>
              {progressLabels.map((label, i) => {
                const st = i < gps.step ? "done" : i === gps.step ? "active" : "pending";
                return (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 0",
                      borderBottom: i < progressLabels.length - 1 ? "1px solid #f2f3f6" : "none",
                    }}
                  >
                    {st === "done" && <Icon name="check_circle" size={22} fill style={{ color: "#0f9d6e" }} />}
                    {st === "active" && (
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          border: "2.5px solid #eef0f4",
                          borderTopColor: "#17181c",
                          borderRadius: "50%",
                          animation: "gvspin .8s linear infinite",
                          flex: "none",
                        }}
                      />
                    )}
                    {st === "pending" && (
                      <span style={{ width: 20, height: 20, border: "2px solid #e2e3ea", borderRadius: "50%", flex: "none" }} />
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: st === "pending" ? 500 : 700,
                        color: st === "pending" ? "#b6b9c2" : st === "done" ? "#5a5d6b" : "#17181c",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {isResult && (
          <>
            <div
              style={{
                position: "relative",
                height: 200,
                borderRadius: 20,
                overflow: "hidden",
                background: "#e8eef0",
                backgroundImage:
                  "linear-gradient(#dfe6e8 1px,transparent 1px),linear-gradient(90deg,#dfe6e8 1px,transparent 1px),linear-gradient(115deg,#cfdbd2 0 18%,transparent 18%),linear-gradient(200deg,#d4dfe6 0 26%,transparent 26%)",
                backgroundSize: "26px 26px,26px 26px,100% 100%,100% 100%",
                margin: "14px 0",
              }}
            >
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "44%", width: 16, background: "#f5f6f8", transform: "rotate(8deg)" }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: "64%", height: 14, background: "#f5f6f8", transform: "rotate(-4deg)" }} />
              <div
                style={{
                  position: "absolute",
                  top: "42%",
                  left: "58%",
                  transform: "translate(-50%,-50%)",
                  width: 130,
                  height: 130,
                  borderRadius: "50%",
                  background: geoFill,
                  border: `2px dashed ${geoColor}`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "42%",
                  left: "58%",
                  transform: "translate(-50%,-100%)",
                  color: "#17181c",
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))",
                }}
              >
                <Icon name="business" size={30} fill />
              </div>
              <div
                style={{
                  position: "absolute",
                  top: empTop,
                  left: empLeft,
                  transform: "translate(-50%,-100%)",
                  color: geoColor,
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,.3))",
                }}
              >
                <Icon name="person_pin_circle" size={30} fill />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  bottom: 10,
                  background: "rgba(255,255,255,.92)",
                  borderRadius: 8,
                  padding: "4px 9px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#5a5d6b",
                }}
              >
                📍 {gps.distance} ม. จากจุดลงเวลา
              </div>
            </div>

            {verified && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "13px 15px",
                    background: "#e7f8f0",
                    borderRadius: 14,
                    marginBottom: 14,
                  }}
                >
                  <Icon name="where_to_vote" size={24} fill style={{ color: "#0f9d6e" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f9d6e" }}>ยืนยันตำแหน่งสำเร็จ</div>
                    <div style={{ fontSize: 11, color: "#5a9c85" }}>
                      {gps.workplaceName} · ระยะ {gps.distance} ม. (รัศมี {gps.radiusMeters} ม.)
                    </div>
                  </div>
                </div>
                <button
                  onClick={confirmGps}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 16,
                    padding: 15,
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 800,
                    background: "#c0e51f",
                    color: "#17181c",
                    cursor: "pointer",
                  }}
                >
                  {confirmLabel}
                </button>
              </>
            )}

            {rejected && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "13px 15px",
                    background: "#fdecec",
                    borderRadius: 14,
                    marginBottom: 14,
                  }}
                >
                  <Icon name="wrong_location" size={24} fill style={{ color: "#d64545" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#d64545" }}>ลงเวลาไม่ได้ — อยู่นอกพื้นที่</div>
                    <div style={{ fontSize: 11, color: "#c07a7a", lineHeight: 1.5 }}>{gps.error}</div>
                  </div>
                </div>
                <button
                  onClick={retryGps}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    border: "none",
                    borderRadius: 16,
                    padding: 15,
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: 800,
                    background: "#17181c",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="refresh" size={20} />
                  ลองอีกครั้ง
                </button>
              </>
            )}
          </>
        )}

        <button
          onClick={closeGps}
          style={{
            width: "100%",
            border: "none",
            background: "none",
            color: "#8a8d99",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            padding: 12,
            cursor: "pointer",
            marginTop: 2,
          }}
        >
          ยกเลิก
        </button>
      </div>
    </>
  );
}
