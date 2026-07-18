"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "./Icon";

export function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#191a2e",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 14px 30px -10px rgba(0,0,0,.5)",
        zIndex: 20,
        animation: "gvtoast .25s ease",
        whiteSpace: "nowrap",
      }}
    >
      <Icon name="check_circle" size={19} style={{ color: "#10b981" }} />
      {state.toast}
    </div>
  );
}
