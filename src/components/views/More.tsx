"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadow } from "@/lib/styles";
import { moreMenuDefs } from "@/lib/mock";
import { initialsOf } from "@/lib/format";
import type { ViewKey } from "@/lib/types";

export function More() {
  const { state, goSub, openLeave, showToast, doLogout } = useApp();
  const me = state.me;
  const initials = initialsOf(me?.name || "");
  const visibleMenu = moreMenuDefs.filter((m) => !me || (m.roles as readonly string[]).includes(me.role));

  const handleClick = (key: string) => {
    switch (key) {
      case "leave":
        openLeave();
        return;
      case "calendar":
        showToast("ปฏิทิน · เร็วๆ นี้");
        return;
      case "docs":
        showToast("เอกสาร · เร็วๆ นี้");
        return;
      case "settings":
        showToast("ตั้งค่า · เร็วๆ นี้");
        return;
      default:
        goSub(key as ViewKey);
    }
  };

  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>เมนูเพิ่มเติม</div>
        <div style={{ fontSize: 12, color: "#8a8d99" }}>More</div>
      </div>

      <div
        onClick={() => goSub("profile")}
        style={{
          margin: "0 16px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "#fff",
          borderRadius: 20,
          padding: 16,
          cursor: "pointer",
          boxShadow: cardShadow,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(140deg,#17181c,#3a3c46)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{me?.name}</div>
          <div style={{ fontSize: 12, color: "#8a8d99" }}>
            {me?.employeeCode} · {me?.department}
          </div>
        </div>
        <Icon name="chevron_right" size={22} style={{ color: "#c9cbd6" }} />
      </div>

      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: cardShadow }}>
        {visibleMenu.map((m) => (
          <div
            key={m.key}
            onClick={() => handleClick(m.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "15px 16px",
              cursor: "pointer",
              borderBottom: "1px solid #f2f3f6",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: m.bg,
                color: m.color,
              }}
            >
              <Icon name={m.icon} size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#9aa0ab" }}>{m.sub}</div>
            </div>
            <Icon name="chevron_right" size={20} style={{ color: "#c9cbd6" }} />
          </div>
        ))}
      </div>

      <button
        onClick={doLogout}
        style={{
          margin: 16,
          width: "calc(100% - 32px)",
          border: "none",
          background: "#fdecec",
          color: "#d64545",
          fontWeight: 700,
          fontSize: 14,
          padding: 14,
          borderRadius: 16,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        ออกจากระบบ
      </button>
      <div style={{ textAlign: "center", fontSize: 11, color: "#b6b9c2", paddingBottom: 16 }}>
        GV-HR · เวอร์ชัน 1.0 · Gadget Villa
      </div>
    </div>
  );
}
