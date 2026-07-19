"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { backBtnStyle, cardShadowSm } from "@/lib/styles";
import { timeAgo } from "@/lib/format";

export function Notifications() {
  const { state, back, markRead } = useApp();
  const notifs = state.notifications.map((n) => ({
    ...n,
    cardBg: n.isRead ? "#fff" : "#fbfcff",
  }));

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <button onClick={back} style={backBtnStyle}>
          <Icon name="arrow_back" size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>การแจ้งเตือน</div>
        </div>
        <button
          onClick={markRead}
          style={{ border: "none", background: "none", color: "#17181c", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
        >
          อ่านทั้งหมด
        </button>
      </div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {notifs.map((n) => (
          <div
            key={n.id}
            style={{
              display: "flex",
              gap: 12,
              background: n.cardBg,
              borderRadius: 16,
              padding: 14,
              boxShadow: cardShadowSm,
            }}
          >
            <div
              style={{
                flex: "none",
                width: 40,
                height: 40,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: n.bg,
                color: n.color,
              }}
            >
              <Icon name={n.icon} size={21} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</span>
                <span style={{ fontSize: 10, color: "#b6b9c2", whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: "#7b7d8c", marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>
            </div>
          </div>
        ))}
        {notifs.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#b6b9c2" }}>
            <Icon name="notifications_off" size={44} />
            <div style={{ fontSize: 13, marginTop: 8 }}>ไม่มีการแจ้งเตือน</div>
          </div>
        )}
      </div>
    </div>
  );
}
