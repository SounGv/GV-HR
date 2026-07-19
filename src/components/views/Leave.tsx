"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { backBtnStyle, cardShadow } from "@/lib/styles";
import { leaveTypeDefs, leaveTypeName } from "@/lib/mock";
import { thDate } from "@/lib/format";

const chipSel: CSSProperties = {
  flex: 1,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 700,
  padding: 13,
  borderRadius: 12,
  background: "#17181c",
  color: "#fff",
};
const chipUn: CSSProperties = {
  flex: 1,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 700,
  padding: 13,
  borderRadius: 12,
  background: "#f5f6fa",
  color: "#7b7d8c",
  border: "1.5px solid #e2e3ea",
};
const attachOn: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: 13,
  borderRadius: 12,
  background: "#e7f8f0",
  color: "#0f9d6e",
  border: "1.5px solid #0f9d6e",
};
const attachOff: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: 13,
  borderRadius: 12,
  background: "#fff",
  color: "#7b7d8c",
  border: "1.5px dashed #c9cbd6",
};

export function Leave() {
  const { state, leaveBack, leaveNext, updLeave, uploadAttachment } = useApp();
  const l = state.leave;
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!l) return null;

  const typeName = l.type ? leaveTypeName[l.type] : "—";
  const nextEnabled = !(l.step === 1 && !l.type);
  const nextBase: CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: 16,
    padding: 15,
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    background: nextEnabled ? "#17181c" : "#c7c8d4",
    cursor: nextEnabled ? "pointer" : "default",
  };

  const reviewRows = [
    { label: "ประเภท", value: l.type ? leaveTypeName[l.type] : "—" },
    {
      label: "วันที่",
      value: (l.from ? thDate(l.from) : "—") + (l.to && l.to !== l.from ? " – " + thDate(l.to) : ""),
    },
    { label: "ระยะเวลา", value: l.half === "half" ? "ครึ่งวัน" : "เต็มวัน" },
    { label: "เหตุผล", value: l.reason || "—" },
    { label: "เอกสารแนบ", value: l.attachmentUrl ? `แนบแล้ว: ${l.attachmentName}` : "ไม่มี" },
  ];

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <button onClick={leaveBack} style={backBtnStyle}>
          <Icon name="arrow_back" size={22} />
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{l.type ? typeName : "สร้างคำขอใหม่"}</div>
          <div style={{ fontSize: 11, color: "#8a8d99" }}>ขั้นตอน {l.step} จาก 4</div>
        </div>
      </div>
      <div style={{ padding: "0 16px 8px" }}>
        <div style={{ height: 5, background: "#eef0f4", borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${(l.step / 4) * 100}%`,
              background: "#17181c",
              borderRadius: 99,
              transition: "width .3s",
            }}
          />
        </div>
      </div>

      {l.step === 1 && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>เลือกประเภทคำขอ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {leaveTypeDefs.map((t) => (
              <div
                key={t.key}
                onClick={() => updLeave("type", t.key)}
                style={{
                  background: "#fff",
                  borderRadius: 18,
                  padding: 15,
                  cursor: "pointer",
                  boxShadow: cardShadow,
                  border: `2px solid ${l.type === t.key ? t.color : "transparent"}`,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: t.bg,
                    color: t.color,
                    marginBottom: 10,
                  }}
                >
                  <Icon name={t.icon} size={23} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#8a8d99" }}>{t.en}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {l.step === 2 && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>เลือกวันที่</div>
          <div style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: cardShadow }}>
            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>ตั้งแต่วันที่</label>
            <input
              type="date"
              value={l.from}
              onChange={(e) => updLeave("from", e.target.value)}
              style={inputStyle}
            />
            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>ถึงวันที่</label>
            <input
              type="date"
              value={l.to}
              onChange={(e) => updLeave("to", e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => updLeave("half", "full")} style={l.half === "full" ? chipSel : chipUn}>
                เต็มวัน
              </button>
              <button onClick={() => updLeave("half", "half")} style={l.half === "half" ? chipSel : chipUn}>
                ครึ่งวัน
              </button>
            </div>
          </div>
        </div>
      )}

      {l.step === 3 && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>เหตุผลและเอกสาร</div>
          <div style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: cardShadow }}>
            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>เหตุผล</label>
            <textarea
              value={l.reason}
              onChange={(e) => updLeave("reason", e.target.value)}
              placeholder="ระบุเหตุผลของคำขอ..."
              style={{ ...inputStyle, minHeight: 100, resize: "none" }}
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAttachment(file);
              }}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={l.uploading}
              style={l.attachmentUrl ? attachOn : attachOff}
            >
              <Icon name={l.uploading ? "hourglass_top" : l.attachmentUrl ? "check_circle" : "attach_file"} size={20} />
              {l.uploading ? "กำลังอัปโหลด..." : l.attachmentUrl ? `แนบแล้ว: ${l.attachmentName}` : "แนบเอกสาร (ถ้ามี)"}
            </button>
          </div>
        </div>
      )}

      {l.step === 4 && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>ตรวจสอบคำขอ</div>
          <div style={{ background: "#fff", borderRadius: 18, padding: "6px 16px", boxShadow: cardShadow }}>
            {reviewRows.map((r) => (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "13px 0",
                  borderBottom: "1px solid #f2f3f6",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#8a8d99" }}>{r.label}</span>
                <span style={{ fontWeight: 600, textAlign: "right", maxWidth: 200 }}>{r.value}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#eef7cc",
              borderRadius: 14,
              padding: 13,
              marginTop: 14,
            }}
          >
            <Icon name="route" size={20} style={{ color: "#17181c" }} />
            <div style={{ fontSize: 12, color: "#17181c" }}>
              คำขอจะถูกส่งไปยัง <b>หัวหน้างาน</b> เพื่ออนุมัติ แล้วแจ้ง HR
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        <button onClick={leaveNext} style={nextBase}>
          {l.step === 4 ? "ส่งคำขอ" : "ถัดไป"}
        </button>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  margin: "6px 0 16px",
  padding: 12,
  border: "1.5px solid #e2e3ea",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 14,
};
