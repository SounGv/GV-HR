"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { BackHeader } from "@/components/BackHeader";
import { cardShadow } from "@/lib/styles";
import { reportMeta, reportSets } from "@/lib/mock";
import type { ReportTab } from "@/lib/types";

const segDefs: { key: ReportTab; label: string }[] = [
  { key: "attendance", label: "เวลาเข้างาน" },
  { key: "leave", label: "การลา" },
  { key: "finance", label: "การเงิน" },
];

export function Reports() {
  const { state, setReportTab, showToast } = useApp();
  const rt = state.reportTab;
  const rm = reportMeta[rt];
  const set = reportSets[rt];
  const rows = set.rows.map((r) => ({ ...r, pct: r.p + "%", barColor: rm.c, barBg: rm.bg }));

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 20 }}>
      <BackHeader title="รายงาน" subtitle="สำหรับ HR · บัญชี · ผู้บริหาร" />

      <div style={{ margin: "0 16px 14px", background: "#eef0f4", borderRadius: 14, padding: 4, display: "flex", gap: 4 }}>
        {segDefs.map((t) => {
          const active = rt === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setReportTab(t.key)}
              style={{
                flex: 1,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 700,
                padding: "10px 4px",
                borderRadius: 11,
                background: active ? "#fff" : "transparent",
                color: active ? "#191a2e" : "#8a8d99",
                boxShadow: active ? "0 2px 8px -3px rgba(0,0,0,.25)" : "none",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
        <button
          onClick={() => showToast("ตัวกรอง: ช่วงเวลา / แผนก")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            border: "1.5px solid #e2e3ea",
            background: "#fff",
            borderRadius: 12,
            padding: 10,
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            color: "#5a5d6b",
            cursor: "pointer",
          }}
        >
          <Icon name="calendar_month" size={17} />
          {set.updated}
        </button>
        <button
          onClick={() => showToast("ตัวกรอง: ช่วงเวลา / แผนก")}
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            border: "1.5px solid #e2e3ea",
            background: "#fff",
            borderRadius: 12,
            padding: "10px 12px",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 700,
            color: "#5a5d6b",
            cursor: "pointer",
          }}
        >
          ทุกแผนก
          <Icon name="arrow_drop_down" size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px" }}>
        {set.cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: cardShadow }}>
            <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "22px 16px 10px", fontSize: 14, fontWeight: 700 }}>{set.title}</div>
      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 18, padding: "8px 16px", boxShadow: cardShadow }}>
        {rows.map((r) => (
          <div key={r.name} style={{ padding: "11px 0", borderBottom: "1px solid #f2f3f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: r.barColor }}>{r.val}</span>
            </div>
            <div style={{ height: 7, background: r.barBg, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: r.pct, background: r.barColor, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, padding: "18px 16px 0" }}>
        <button
          onClick={() => showToast("กำลังส่งออก Excel...")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            border: "none",
            background: "#e7f8f0",
            color: "#0f9d6e",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            padding: 13,
            borderRadius: 14,
            cursor: "pointer",
          }}
        >
          <Icon name="table_view" size={19} />
          Excel
        </button>
        <button
          onClick={() => showToast("กำลังส่งออก PDF...")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            border: "none",
            background: "#fdecec",
            color: "#d64545",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 700,
            padding: 13,
            borderRadius: 14,
            cursor: "pointer",
          }}
        >
          <Icon name="picture_as_pdf" size={19} />
          PDF
        </button>
      </div>
    </div>
  );
}
