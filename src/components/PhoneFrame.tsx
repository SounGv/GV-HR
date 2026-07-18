import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export function PhoneFrame({
  chromeBg,
  chromeFg,
  nowClock,
  children,
  bottomNav,
  overlays,
}: {
  chromeBg: string;
  chromeFg: string;
  nowClock: string;
  children: ReactNode;
  bottomNav?: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "radial-gradient(120% 90% at 50% 0%,#eef0f5 0%,#dfe1e9 100%)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 390,
          height: 844,
          background: "#0b0b16",
          borderRadius: 52,
          padding: 11,
          boxShadow: "0 40px 80px -24px rgba(20,20,50,.55),0 0 0 1px rgba(0,0,0,.06)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background: "#f5f6f8",
            borderRadius: 42,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <StatusBar bg={chromeBg} fg={chromeFg} clock={nowClock} />
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative" }}>
            {children}
          </div>
          {bottomNav}
          {overlays}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ bg, fg, clock }: { bg: string; fg: string; clock: string }) {
  const style: CSSProperties = {
    flex: "none",
    height: 52,
    padding: "0 26px 0 30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: bg,
    color: fg,
    position: "relative",
    zIndex: 5,
  };
  return (
    <div style={style}>
      <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{clock}</span>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 9,
          transform: "translateX(-50%)",
          width: 104,
          height: 30,
          background: "#0b0b16",
          borderRadius: 16,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="signal_cellular_alt" size={17} />
        <Icon name="wifi" size={17} />
        <Icon name="battery_full" size={19} />
      </div>
    </div>
  );
}
