import { fmtBaht } from "./format";
import type { PayrollRow } from "./types";

export function clockStatus(opts: {
  clockedIn: boolean;
  clockInTs: number | null;
  clockOutTs: number | null;
  now: number;
}) {
  const { clockedIn, clockInTs, clockOutTs, now } = opts;
  const done = !!clockOutTs;
  const isWorking = clockedIn && !!clockInTs;
  let statusText = "ยังไม่เข้างาน";
  let statusBg = "#f1f2f5";
  let statusFg = "#7b7d8c";
  let late = false;
  if (clockInTs) {
    const ci = new Date(clockInTs);
    late = ci.getHours() > 9 || (ci.getHours() === 9 && ci.getMinutes() > 0);
  }
  if (done) {
    statusText = "ทำงานครบแล้ว";
    statusBg = "#e7f8f0";
    statusFg = "#0f9d6e";
  } else if (isWorking) {
    statusText = late ? "เข้างานสาย" : "กำลังทำงาน";
    statusBg = late ? "#fff7e6" : "#e7f8f0";
    statusFg = late ? "#b7791f" : "#0f9d6e";
  }
  let workedStr = "00:00:00";
  if (isWorking && clockInTs) {
    const sec = Math.max(0, Math.floor((now - clockInTs) / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const se = sec % 60;
    workedStr = [h, m, se].map((x) => String(x).padStart(2, "0")).join(":");
  }
  const clockState: "in" | "out" | "done" = done ? "done" : isWorking ? "out" : "in";
  const btnBase = {
    width: "100%",
    border: "none",
    borderRadius: 18,
    padding: 16,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "#fff",
  } as const;
  const clockBtnStyle =
    clockState === "in"
      ? { ...btnBase, background: "#c0e51f", color: "#17181c", animation: "gvpulse 2s infinite" }
      : clockState === "out"
        ? { ...btnBase, background: "linear-gradient(135deg,#fa5252,#e8590c)" }
        : {
            width: "100%",
            border: "none",
            borderRadius: 18,
            padding: 16,
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "#eef0f4",
            color: "#9aa0ab",
            cursor: "default",
          };
  const clockBtnLabel =
    clockState === "in" ? "ลงเวลาเข้างาน" : clockState === "out" ? "ลงเวลาออกงาน" : "เสร็จสิ้นวันทำงาน";
  const clockBtnSub =
    clockState === "in"
      ? "Clock In · แตะเพื่อบันทึก"
      : clockState === "out"
        ? "Clock Out · แตะเพื่อบันทึก"
        : "ขอบคุณสำหรับวันนี้";
  const clockBtnIcon = clockState === "in" ? "login" : clockState === "out" ? "logout" : "check_circle";

  return {
    statusText,
    statusBg,
    statusFg,
    isWorking,
    workedStr,
    clockBtnStyle,
    clockBtnLabel,
    clockBtnSub,
    clockBtnIcon,
  };
}

export function formatPayroll(rows: PayrollRow[], showPay: boolean) {
  const mask = "฿ ••••••";
  const latest = rows[0];
  const earnings = (latest?.earnings || []).map((e) => ({
    ...e,
    amtDisp: showPay ? fmtBaht(e.amt) : "฿ ••••",
  }));
  const deductions = (latest?.deductions || []).map((d) => ({
    ...d,
    amtDisp: showPay ? "-" + fmtBaht(d.amt) : "฿ ••••",
  }));
  const history = rows.map((p) => ({
    ...p,
    netDisp: showPay ? fmtBaht(p.net) : "฿ ••••",
  }));

  return {
    earnings,
    deductions,
    history,
    lastPeriodLabel: latest?.periodLabel || "-",
    payNetDisplay: latest ? (showPay ? fmtBaht(latest.net) : mask) : mask,
    payGrossDisplay: latest ? (showPay ? fmtBaht(latest.gross) : "฿ ••••") : "฿ ••••",
    payDedDisplay: latest ? (showPay ? "-" + fmtBaht(latest.totalDeductions) : "฿ ••••") : "฿ ••••",
  };
}
