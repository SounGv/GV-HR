"use client";

import { useApp } from "@/context/AppContext";
import { tabDefs } from "@/lib/mock";
import { Icon } from "./Icon";

const views: string[] = ["home", "attendance", "requests", "payroll", "more"];

export function BottomNav() {
  const { state, go } = useApp();
  if (!views.includes(state.view)) return null;

  return (
    <div
      style={{
        flex: "none",
        display: "flex",
        background: "#ffffff",
        borderTop: "1px solid #edeef2",
        padding: "8px 6px 22px",
        boxShadow: "0 -6px 20px -14px rgba(30,30,80,.35)",
        position: "relative",
        zIndex: 5,
      }}
    >
      {tabDefs.map((t) => {
        const active = state.tab === t.key && views.includes(state.view);
        const col = active ? "#17181c" : "#a3a6b2";
        return (
          <button
            key={t.key}
            onClick={() => go(t.key, t.key)}
            style={{
              flex: 1,
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "4px 0",
              fontFamily: "inherit",
            }}
          >
            <Icon name={t.icon} size={25} fill={active} style={{ color: col }} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: col }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
