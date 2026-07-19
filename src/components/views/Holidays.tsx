"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { BackHeader } from "@/components/BackHeader";
import { cardShadowSm } from "@/lib/styles";
import { thDaysShort, thMonths } from "@/lib/format";

const chipHSel: CSSProperties = {
  flex: 1,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: 12,
  borderRadius: 12,
  background: "#17181c",
  color: "#c0e51f",
};
const chipHUn: CSSProperties = {
  flex: 1,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  padding: 12,
  borderRadius: 12,
  background: "#f5f6fa",
  color: "#7b7d8c",
  border: "1.5px solid #e2e3ea",
};

const typeLabel: Record<"company" | "national", string> = {
  company: "วันหยุดบริษัท",
  national: "นักขัตฤกษ์",
};

function typeStyle(t: "company" | "national"): CSSProperties {
  return t === "company"
    ? { background: "#eef7cc", color: "#5a7000" }
    : { background: "#fdecec", color: "#d64545" };
}

export function Holidays() {
  const {
    state,
    openHoliday,
    closeHoliday,
    updH,
    addHoliday,
    delHoliday,
    toggleHNotify,
  } = useApp();
  const [holidayRemind, setHolidayRemind] = useState(true);
  const isHr = state.me?.role === "hr";

  const holidayList = state.holidays.map((h) => {
    const d = new Date(h.dateISO);
    return {
      ...h,
      dnum: d.getDate(),
      mon: thMonths[d.getMonth()],
      full: thDaysShort[d.getDay()] + " " + d.getDate() + " " + thMonths[d.getMonth()] + " " + (d.getFullYear() + 543),
    };
  });
  const notifyOnCount = state.holidays.filter((h) => h.notifyEnabled).length;
  const hf = state.hForm;

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 24 }}>
      <BackHeader title="วันหยุดบริษัท" subtitle="กำหนดโดย HR" />

      <div style={{ display: "flex", gap: 12, padding: "0 16px 12px" }}>
        <div style={{ flex: 1, background: "#17181c", borderRadius: 18, padding: 16, color: "#fff" }}>
          <div style={{ fontSize: 11, opacity: 0.7 }}>วันหยุดทั้งปี</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#c0e51f" }}>
            {state.holidays.length} <span style={{ fontSize: 13, color: "#fff", opacity: 0.7 }}>วัน</span>
          </div>
        </div>
        <div style={{ flex: 1, background: "#fff", borderRadius: 18, padding: 16, boxShadow: cardShadowSm }}>
          <div style={{ fontSize: 11, color: "#7b7d8c", fontWeight: 600 }}>เปิดแจ้งเตือน</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#5a7000" }}>
            {notifyOnCount} <span style={{ fontSize: 13, color: "#9aa0ab" }}>วัน</span>
          </div>
        </div>
      </div>

      <div
        style={{
          margin: "0 16px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#fff",
          borderRadius: 16,
          padding: "14px 16px",
          boxShadow: cardShadowSm,
        }}
      >
        <Icon name="campaign" size={22} style={{ color: "#5a7000" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>เตือนพนักงานล่วงหน้า</div>
          <div style={{ fontSize: 11, color: "#8a8d99" }}>ส่งแจ้งเตือน 3 วันก่อนวันหยุด</div>
        </div>
        <button
          onClick={() => setHolidayRemind((v) => !v)}
          style={{
            width: 46,
            height: 27,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            position: "relative",
            flex: "none",
            transition: "background .2s",
            background: holidayRemind ? "#c0e51f" : "#d7d9e2",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 21,
              height: 21,
              borderRadius: "50%",
              background: "#fff",
              transition: "transform .2s",
              transform: `translateX(${holidayRemind ? 19 : 0}px)`,
              boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            }}
          />
        </button>
      </div>

      {isHr && (
        <button
          onClick={openHoliday}
          style={{
            margin: "0 16px 14px",
            width: "calc(100% - 32px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: "none",
            background: "#c0e51f",
            color: "#17181c",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 800,
            padding: 14,
            borderRadius: 16,
            cursor: "pointer",
          }}
        >
          <Icon name="add" size={20} />
          เพิ่มวันหยุด
        </button>
      )}

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {holidayList.map((h) => (
          <div
            key={h.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              background: "#fff",
              borderRadius: 16,
              padding: "12px 14px",
              boxShadow: cardShadowSm,
              animation: "gvslide .3s ease",
            }}
          >
            <div
              style={{
                flex: "none",
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "#f5f6fa",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{h.dnum}</div>
              <div style={{ fontSize: 10, color: "#8a8d99", fontWeight: 700 }}>{h.mon}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{h.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, ...typeStyle(h.type) }}>
                  {typeLabel[h.type]}
                </span>
                <span style={{ fontSize: 11, color: "#9aa0ab" }}>{h.full}</span>
              </div>
            </div>
            <button
              onClick={() => isHr && toggleHNotify(h.id)}
              disabled={!isHr}
              style={{
                width: 36,
                height: 36,
                border: "none",
                borderRadius: 11,
                cursor: isHr ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: h.notifyEnabled ? "#eef7cc" : "#f1f2f5",
                color: h.notifyEnabled ? "#5a7000" : "#a3a6b2",
              }}
            >
              <Icon name={h.notifyEnabled ? "notifications_active" : "notifications_off"} size={20} />
            </button>
            {isHr && (
              <button
                onClick={() => delHoliday(h.id)}
                style={{
                  width: 36,
                  height: 36,
                  border: "none",
                  borderRadius: 11,
                  background: "#fff",
                  color: "#c9cbd6",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="delete" size={20} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isHr && state.holidaySheet && (
        <>
          <div
            onClick={closeHoliday}
            style={{ position: "absolute", inset: 0, background: "rgba(15,15,35,.5)", zIndex: 25, animation: "gvfade .2s ease" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              background: "#fff",
              borderRadius: "28px 28px 0 0",
              zIndex: 26,
              padding: "8px 20px 26px",
              animation: "gvsheet .3s cubic-bezier(.2,.9,.3,1)",
              boxShadow: "0 -20px 50px -20px rgba(0,0,0,.4)",
            }}
          >
            <div style={{ width: 40, height: 5, background: "#e2e3ea", borderRadius: 99, margin: "6px auto 16px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>เพิ่มวันหยุด</div>

            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>ชื่อวันหยุด</label>
            <input
              value={hf.name}
              onChange={(e) => updH("name", e.target.value)}
              placeholder="เช่น วันหยุดกลางปีบริษัท"
              style={{ width: "100%", margin: "6px 0 14px", padding: 12, border: "1.5px solid #e2e3ea", borderRadius: 12, fontFamily: "inherit", fontSize: 14 }}
            />
            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>วันที่</label>
            <input
              type="date"
              value={hf.date}
              onChange={(e) => updH("date", e.target.value)}
              style={{ width: "100%", margin: "6px 0 14px", padding: 12, border: "1.5px solid #e2e3ea", borderRadius: 12, fontFamily: "inherit", fontSize: 14 }}
            />
            <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>ประเภท</label>
            <div style={{ display: "flex", gap: 10, margin: "6px 0 14px" }}>
              <button onClick={() => updH("type", "company")} style={hf.type === "company" ? chipHSel : chipHUn}>
                วันหยุดบริษัท
              </button>
              <button onClick={() => updH("type", "national")} style={hf.type === "national" ? chipHSel : chipHUn}>
                นักขัตฤกษ์
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#f5f6fa",
                borderRadius: 14,
                padding: "13px 15px",
                marginBottom: 16,
              }}
            >
              <Icon name="notifications_active" size={20} style={{ color: "#5a7000" }} />
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>เด้งแจ้งเตือนพนักงาน</div>
              <button
                onClick={() => updH("notify", !hf.notify)}
                style={{
                  width: 46,
                  height: 27,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  flex: "none",
                  transition: "background .2s",
                  background: hf.notify ? "#c0e51f" : "#d7d9e2",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 3,
                    width: 21,
                    height: 21,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "transform .2s",
                    transform: `translateX(${hf.notify ? 19 : 0}px)`,
                    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                  }}
                />
              </button>
            </div>
            <button
              onClick={addHoliday}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 16,
                padding: 15,
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 800,
                background: hf.name && hf.date ? "#17181c" : "#e6e7ec",
                color: hf.name && hf.date ? "#c0e51f" : "#a3a6b2",
                cursor: hf.name && hf.date ? "pointer" : "default",
              }}
            >
              บันทึกวันหยุด
            </button>
            <button
              onClick={closeHoliday}
              style={{ width: "100%", border: "none", background: "none", color: "#8a8d99", fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: 12, cursor: "pointer", marginTop: 2 }}
            >
              ยกเลิก
            </button>
          </div>
        </>
      )}
    </div>
  );
}
