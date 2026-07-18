"use client";

import type { ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { backBtnStyle } from "@/lib/styles";
import { Icon } from "./Icon";

export function BackHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { back } = useApp();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
      <button onClick={onBack || back} style={backBtnStyle}>
        <Icon name="arrow_back" size={22} />
      </button>
      <div style={{ flex: right ? 1 : undefined }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#8a8d99", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}
