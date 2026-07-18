"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadowSm } from "@/lib/styles";
import { attHistory, attStats } from "@/lib/mock";

export function Attendance() {
  const { openCorrection } = useApp();
  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ประวัติเวลาทำงาน</div>
        <div style={{ fontSize: 12, color: "#8a8d99" }}>Attendance · กรกฎาคม 2568</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, padding: "0 16px 8px" }}>
        {attStats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "12px 8px",
              textAlign: "center",
              boxShadow: cardShadowSm,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#8a8d99", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "8px 16px 0" }}>
        <button
          onClick={openCorrection}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: "1.5px dashed #c9cbd6",
            background: "#fff",
            color: "#17181c",
            fontWeight: 700,
            fontSize: 13,
            padding: 13,
            borderRadius: 16,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Icon name="edit_calendar" size={19} />
          ขอแก้ไขเวลา (ลืมลงเวลา)
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {attHistory.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "#fff",
              borderRadius: 16,
              padding: 14,
              boxShadow: cardShadowSm,
            }}
          >
            <div
              style={{
                flex: "none",
                width: 44,
                height: 44,
                borderRadius: 13,
                background: "#f5f6fa",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 11, color: "#8a8d99", fontWeight: 700 }}>{a.day}</div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{a.dnum}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{a.date}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: "#5a5d6b" }}>
                  <b style={{ color: "#10b981" }}>↓</b> {a.in}
                </span>
                <span style={{ fontSize: 12, color: "#5a5d6b" }}>
                  <b style={{ color: "#ef4444" }}>↑</b> {a.out}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: a.color, textAlign: "right", maxWidth: 76 }}>
              {a.status}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
