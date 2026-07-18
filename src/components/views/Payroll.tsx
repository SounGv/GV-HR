"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { cardShadowSm, darkShadow } from "@/lib/styles";
import { payrollData } from "@/lib/derive";

export function Payroll() {
  const { state, togglePay, goSub } = useApp();
  const p = payrollData(state.showPay);

  return (
    <div style={{ animation: "gvpop .25s ease" }}>
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>เงินเดือน</div>
        <div style={{ fontSize: 12, color: "#8a8d99" }}>Payroll</div>
      </div>

      <div
        style={{
          margin: "0 16px",
          background: "linear-gradient(150deg,#17181c,#0c0d10)",
          borderRadius: 24,
          padding: 22,
          color: "#fff",
          boxShadow: darkShadow,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>รายได้สุทธิงวดล่าสุด · มิถุนายน 2568</div>
          <button
            onClick={togglePay}
            style={{
              border: "none",
              background: "rgba(255,255,255,.16)",
              color: "#fff",
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={state.showPay ? "visibility_off" : "visibility"} size={20} />
          </button>
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 0.5, margin: "4px 0 14px" }}>
          {p.payNetDisplay}
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>รายได้รวม</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.payGrossDisplay}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>รายการหัก</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{p.payDedDisplay}</div>
          </div>
        </div>
        <button
          onClick={() => goSub("payslip")}
          style={{
            marginTop: 16,
            width: "100%",
            border: "none",
            background: "rgba(255,255,255,.16)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            padding: 12,
            borderRadius: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
          }}
        >
          <Icon name="receipt_long" size={19} />
          ดูสลิปเงินเดือน
        </button>
      </div>

      <div style={{ padding: "22px 16px 8px", fontSize: 14, fontWeight: 700 }}>ประวัติเงินเดือน</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {p.payHistory.map((h) => (
          <div
            key={h.period}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#fff",
              borderRadius: 16,
              padding: 15,
              boxShadow: cardShadowSm,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "#eef7cc",
                  color: "#17181c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="calendar_month" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{h.period}</div>
                <div style={{ fontSize: 11, color: "#8a8d99" }}>จ่ายแล้ว</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{h.netDisp}</div>
              <Icon name="chevron_right" size={18} style={{ color: "#c9cbd6" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}
