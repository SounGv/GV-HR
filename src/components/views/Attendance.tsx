"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadowSm } from "@/lib/styles";
import { hhmm, thDaysShort, thMonths } from "@/lib/format";
import type { AttendanceRecordRow } from "@/lib/types";

function isLate(iso: string) {
  const d = new Date(iso);
  return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 0);
}

function rowInfo(r: AttendanceRecordRow) {
  if (!r.clockInAt) return { status: "ขาดงาน", color: "#7b7d8c" };
  if (!r.clockOutAt) return { status: "ลืมลงเวลาออก", color: "#ef4444" };
  if (isLate(r.clockInAt)) return { status: "สายเข้างาน", color: "#f59e0b" };
  const outH = new Date(r.clockOutAt).getHours() + new Date(r.clockOutAt).getMinutes() / 60;
  if (outH > 18.25) return { status: "ปกติ +OT", color: "#0f9d6e" };
  return { status: "ปกติ", color: "#0f9d6e" };
}

export function Attendance() {
  const { state, openCorrection } = useApp();
  const history = state.attendanceHistory;

  const present = history.filter((r) => r.clockInAt).length;
  const late = history.filter((r) => r.clockInAt && isLate(r.clockInAt)).length;
  const absent = history.filter((r) => !r.clockInAt).length;
  const otHours = history.reduce((sum, r) => {
    if (!r.clockOutAt) return sum;
    const d = new Date(r.clockOutAt);
    const h = d.getHours() + d.getMinutes() / 60;
    return sum + Math.max(0, h - 18);
  }, 0);

  const attStats = [
    { label: "มาทำงาน", value: String(present), color: "#0f9d6e" },
    { label: "สาย", value: String(late), color: "#f59e0b" },
    { label: "ขาด", value: String(absent), color: "#ef4444" },
    { label: "OT (ชม.)", value: otHours.toFixed(0), color: "#17181c" },
  ];

  const rows = history.map((r) => {
    const d = new Date(r.workDate);
    const info = rowInfo(r);
    return {
      id: r.id,
      day: thDaysShort[d.getDay()],
      dnum: d.getDate(),
      date: `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`,
      in: hhmm(r.clockInAt ? new Date(r.clockInAt).getTime() : null),
      out: hhmm(r.clockOutAt ? new Date(r.clockOutAt).getTime() : null),
      status: info.status,
      color: info.color,
    };
  });

  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ประวัติเวลาทำงาน</div>
        <div style={{ fontSize: 12, color: "#8a8d99" }}>Attendance · 30 วันล่าสุด</div>
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
        {rows.map((a) => (
          <div
            key={a.id}
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
        {rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#b6b9c2" }}>
            <Icon name="event_busy" size={44} />
            <div style={{ fontSize: 13, marginTop: 8 }}>ยังไม่มีประวัติการลงเวลา</div>
          </div>
        )}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
