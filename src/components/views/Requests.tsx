"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadowSm } from "@/lib/styles";
import { requestIconMap, statusMeta } from "@/lib/mock";
import type { RequestStatus } from "@/lib/types";

const chipDefs: { key: "all" | RequestStatus; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "Pending", label: "รออนุมัติ" },
  { key: "Approved", label: "อนุมัติแล้ว" },
  { key: "Rejected", label: "ไม่อนุมัติ" },
];

export function Requests() {
  const { state, setFilter, openLeave } = useApp();

  const reqs = state.requests.map((r) => {
    const m = statusMeta[r.status];
    const km = requestIconMap[r.key] || requestIconMap.annual;
    return { ...r, statusTh: m.th, statusBg: m.bg, statusFg: m.fg, statusDot: m.dot, icon: km.icon, iconBg: km.bg, iconFg: km.fg };
  });
  const filtered = state.reqFilter === "all" ? reqs : reqs.filter((r) => r.status === state.reqFilter);

  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div style={{ padding: "20px 20px 14px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>ศูนย์คำขอ</div>
        <div style={{ fontSize: 12, color: "#8a8d99" }}>Request Center</div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
        {chipDefs.map((c) => {
          const active = state.reqFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              style={{
                flex: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 15px",
                borderRadius: 999,
                background: active ? "#17181c" : "#fff",
                color: active ? "#fff" : "#7b7d8c",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((r) => (
          <div
            key={r.id}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 15,
              boxShadow: cardShadowSm,
              animation: "gvslide .3s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  flex: "none",
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: r.iconBg,
                  color: r.iconFg,
                }}
              >
                <Icon name={r.icon} size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.type}</div>
                <div style={{ fontSize: 11, color: "#8a8d99" }}>
                  {r.id} · {r.dateLabel}
                </div>
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: r.statusBg,
                  color: r.statusFg,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.statusDot }} />
                {r.statusTh}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 11,
                paddingTop: 11,
                borderTop: "1px solid #f0f1f4",
                fontSize: 11,
                color: "#8a8d99",
              }}
            >
              <span>{r.sub}</span>
              <span>ส่งเมื่อ {r.submitted}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#b6b9c2" }}>
            <Icon name="inbox" size={44} />
            <div style={{ fontSize: 13, marginTop: 8 }}>ไม่มีคำขอในหมวดนี้</div>
          </div>
        )}
      </div>
      <div style={{ height: 90 }} />

      <button
        onClick={() => openLeave()}
        style={{
          position: "absolute",
          right: 18,
          bottom: 96,
          width: 56,
          height: 56,
          borderRadius: 20,
          border: "none",
          background: "#17181c",
          color: "#fff",
          boxShadow: "0 14px 28px -8px rgba(23,24,28,.6)",
          cursor: "pointer",
          zIndex: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="add" size={28} />
      </button>
    </div>
  );
}
