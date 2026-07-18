"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { BackHeader } from "@/components/BackHeader";
import { backBtnStyle, cardShadow } from "@/lib/styles";
import { payrollData } from "@/lib/derive";
import { employeeName } from "@/lib/mock";

export function Payslip() {
  const { state, togglePay, downloadSlip } = useApp();
  const p = payrollData(state.showPay);

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
      <BackHeader
        title="สลิปเงินเดือน"
        subtitle="มิถุนายน 2568"
        right={
          <button onClick={togglePay} style={{ ...backBtnStyle, color: "#17181c" }}>
            <Icon name={state.showPay ? "visibility_off" : "visibility"} size={22} />
          </button>
        }
      />

      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 20, padding: 20, boxShadow: cardShadow }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 14,
            borderBottom: "1px dashed #e2e3ea",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Gadget Villa Co., Ltd.</div>
            <div style={{ fontSize: 11, color: "#8a8d99" }}>{employeeName} · EMP-1042</div>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "#17181c",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            GV
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f9d6e", margin: "14px 0 8px" }}>รายได้</div>
        {p.earnings.map((e) => (
          <div key={e.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
            <span style={{ color: "#5a5d6b" }}>{e.label}</span>
            <span style={{ fontWeight: 600 }}>{e.amtDisp}</span>
          </div>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, color: "#d64545", margin: "14px 0 8px" }}>รายการหัก</div>
        {p.deductions.map((d) => (
          <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
            <span style={{ color: "#5a5d6b" }}>{d.label}</span>
            <span style={{ fontWeight: 600, color: "#d64545" }}>{d.amtDisp}</span>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "2px solid #191a2e",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800 }}>รายได้สุทธิ</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#0f9d6e" }}>{p.payNetDisplay}</span>
        </div>
      </div>

      <button
        onClick={downloadSlip}
        style={{
          margin: 16,
          width: "calc(100% - 32px)",
          border: "none",
          background: "#17181c",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          padding: 14,
          borderRadius: 16,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Icon name="download" size={20} />
        ดาวน์โหลด PDF
      </button>
    </div>
  );
}
