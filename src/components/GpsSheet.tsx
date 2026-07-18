"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "./Icon";

export function GpsSheet() {
  const { state, closeGps, confirmGps } = useApp();
  const gps = state.gps;
  if (!gps) return null;

  const locating = gps.phase === "locating";
  const ready = gps.phase === "ready";
  const title = gps.mode === "out" ? "ลงเวลาออกงาน" : "ลงเวลาเข้างาน";
  const confirmLabel = gps.mode === "out" ? "ยืนยันออกงาน" : "ยืนยันเข้างาน";

  return (
    <>
      <div
        onClick={closeGps}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,15,35,.5)",
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
        }}
      >
        <div
          style={{
            width: 40,
            height: 5,
            background: "#e2e3ea",
            borderRadius: 99,
            margin: "6px auto 16px",
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#8a8d99", marginBottom: 14 }}>
          ยืนยันตำแหน่งด้วย GPS ก่อนบันทึกเวลา
        </div>

        <div
          style={{
            position: "relative",
            height: 168,
            borderRadius: 18,
            overflow: "hidden",
            background: "#e8eef0",
            backgroundImage:
              "linear-gradient(#dfe6e8 1px,transparent 1px),linear-gradient(90deg,#dfe6e8 1px,transparent 1px),linear-gradient(115deg,#cfdbd2 0 18%,transparent 18%),linear-gradient(200deg,#d4dfe6 0 26%,transparent 26%)",
            backgroundSize: "26px 26px,26px 26px,100% 100%,100% 100%",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "44%",
              width: 16,
              background: "#f5f6f8",
              transform: "rotate(8deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "58%",
              height: 14,
              background: "#f5f6f8",
              transform: "rotate(-4deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 88,
              height: 88,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "rgba(23,24,28,.18)",
                animation: "gvping 1.8s ease-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-100%)",
                color: "#17181c",
                filter: "drop-shadow(0 3px 4px rgba(0,0,0,.25))",
              }}
            >
              <Icon name="location_on" size={40} fill />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 10,
              bottom: 10,
              background: "rgba(255,255,255,.9)",
              borderRadius: 8,
              padding: "4px 9px",
              fontSize: 10,
              fontWeight: 700,
              color: "#5a5d6b",
            }}
          >
            Gadget Villa HQ
          </div>
        </div>

        {locating && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              margin: "16px 0",
              padding: "13px 15px",
              background: "#f5f6fa",
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: "2.5px solid #d7d9e2",
                borderTopColor: "#17181c",
                borderRadius: "50%",
                animation: "gvspin .8s linear infinite",
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#5a5d6b" }}>
              กำลังระบุตำแหน่ง GPS...
            </div>
          </div>
        )}

        {ready && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              margin: "16px 0",
              padding: "13px 15px",
              background: "#e7f8f0",
              borderRadius: 14,
              animation: "gvfade .25s ease",
            }}
          >
            <Icon name="where_to_vote" size={22} fill style={{ color: "#0f9d6e" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f9d6e" }}>
                อยู่ในพื้นที่สำนักงาน
              </div>
              <div style={{ fontSize: 11, color: "#5a9c85" }}>
                ห่างจากจุดลงเวลา 12 ม. · ความแม่นยำ ±8 ม.
              </div>
            </div>
          </div>
        )}

        <button
          onClick={confirmGps}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 16,
            padding: 15,
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            background: ready ? "#12b886" : "#c7c8d4",
            cursor: ready ? "pointer" : "default",
          }}
        >
          {confirmLabel}
        </button>
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
