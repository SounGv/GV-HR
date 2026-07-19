"use client";

import type { CSSProperties } from "react";
import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { backBtnStyle, cardShadowSm } from "@/lib/styles";
import { aiDeptDefs } from "@/lib/mock";
import { initialsOf } from "@/lib/format";

const segStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  padding: "10px 4px",
  borderRadius: 11,
  background: active ? "#fff" : "transparent",
  color: active ? "#17181c" : "#8a8d99",
  boxShadow: active ? "0 2px 8px -3px rgba(0,0,0,.25)" : "none",
});

export function AiEval() {
  const { state, back, setAiMode, setAiDept, setAiRole, setAiEmp, genCriteria, genDraft, showToast } = useApp();
  const aiR = state.aiResult;

  const aiComps =
    aiR && aiR.type === "criteria"
      ? aiR.competencies.map((c) => ({ name: c.name, weightStr: c.weight + "%", indicatorsText: c.indicators.join("   ·   ") }))
      : [];
  const aiKpis =
    aiR && aiR.type === "criteria"
      ? aiR.kpis.map((k) => ({ name: k.name, weightStr: k.weight + "%", target: k.target }))
      : [];
  const aiTotal =
    aiR && aiR.type === "criteria"
      ? [...aiR.competencies, ...aiR.kpis].reduce((a, b) => a + (b.weight || 0), 0)
      : 0;

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
        <button onClick={back} style={backBtnStyle}>
          <Icon name="arrow_back" size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Icon
              name="auto_awesome"
              size={22}
              style={{ color: "#17181c", background: "#c0e51f", borderRadius: 8, padding: 2 }}
            />
            <div style={{ fontSize: 18, fontWeight: 800 }}>AI ช่วยประเมิน</div>
          </div>
          <div style={{ fontSize: 11, color: "#8a8d99", marginTop: 2 }}>
            ให้ AI คิดเกณฑ์ให้ — แต่ละฝ่ายไม่เหมือนกัน ไม่ต้องปวดหัว
          </div>
        </div>
      </div>

      <div style={{ margin: "0 16px 16px", background: "#eef0f4", borderRadius: 14, padding: 4, display: "flex", gap: 4 }}>
        <button onClick={() => setAiMode("criteria")} style={segStyle(state.aiMode === "criteria")}>
          ออกแบบเกณฑ์
        </button>
        <button onClick={() => setAiMode("draft")} style={segStyle(state.aiMode === "draft")}>
          ร่างผลประเมิน
        </button>
      </div>

      {state.aiMode === "criteria" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>เลือกแผนกที่ต้องการประเมิน</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {aiDeptDefs.map((d) => {
              const active = state.aiDept === d;
              return (
                <button
                  key={d}
                  onClick={() => setAiDept(d)}
                  style={{
                    flex: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "9px 15px",
                    borderRadius: 999,
                    background: active ? "#17181c" : "#fff",
                    color: active ? "#c0e51f" : "#5a5d6b",
                    boxShadow: active ? "none" : "0 3px 10px -6px rgba(0,0,0,.3)",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>ตำแหน่ง (ไม่บังคับ)</label>
          <input
            value={state.aiRole}
            onChange={(e) => setAiRole(e.target.value)}
            placeholder="เช่น พนักงานแพ็คสินค้า, เซลล์"
            style={{ width: "100%", margin: "6px 0 16px", padding: 12, border: "1.5px solid #e2e3ea", borderRadius: 12, fontFamily: "inherit", fontSize: 14 }}
          />
          <button
            onClick={genCriteria}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              border: "none",
              borderRadius: 16,
              padding: 15,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 800,
              background: state.aiDept ? "#c0e51f" : "#e6e7ec",
              color: state.aiDept ? "#17181c" : "#a3a6b2",
              cursor: state.aiDept ? "pointer" : "default",
            }}
          >
            <Icon name="auto_awesome" size={21} />
            ให้ AI ช่วยคิด
          </button>
        </div>
      )}

      {state.aiMode === "draft" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>เลือกพนักงานที่จะเขียนความเห็น</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {state.aiEmployees.map((e) => {
              const sel = state.aiEmp?.id === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => setAiEmp(e)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#fff",
                    borderRadius: 16,
                    padding: "13px 14px",
                    cursor: "pointer",
                    boxShadow: cardShadowSm,
                    border: `2px solid ${sel ? "#17181c" : "transparent"}`,
                  }}
                >
                  <div
                    style={{
                      flex: "none",
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: "linear-gradient(140deg,#17181c,#3a3c46)",
                      color: "#c0e51f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    {initialsOf(e.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: "#8a8d99" }}>
                      {e.department} · {e.scores}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={genDraft}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              border: "none",
              borderRadius: 16,
              padding: 15,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 800,
              background: state.aiEmp ? "#c0e51f" : "#e6e7ec",
              color: state.aiEmp ? "#17181c" : "#a3a6b2",
              cursor: state.aiEmp ? "pointer" : "default",
            }}
          >
            <Icon name="auto_awesome" size={21} />
            ให้ AI ร่างความเห็น
          </button>
        </div>
      )}

      {state.aiLoading && (
        <div
          style={{
            margin: "20px 16px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            padding: 34,
            background: "#fff",
            borderRadius: 18,
            boxShadow: cardShadowSm,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              border: "3px solid #eef0f4",
              borderTopColor: "#c0e51f",
              borderRadius: "50%",
              animation: "gvspin .8s linear infinite",
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5a5d6b" }}>
            AI กำลังคิดเกณฑ์ที่เหมาะกับแผนกนี้...
          </div>
        </div>
      )}

      {!!state.aiError && (
        <div
          style={{
            margin: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fdecec",
            borderRadius: 14,
            padding: 14,
            color: "#d64545",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Icon name="error" size={20} />
          {state.aiError}
        </div>
      )}

      {aiR && aiR.type === "criteria" && (
        <div style={{ animation: "gvpop .25s ease" }}>
          <div
            style={{
              margin: "18px 16px 0",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "#eef7cc",
              border: "1px solid #d6e88f",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Icon name="tips_and_updates" size={20} style={{ color: "#5a7000" }} />
            <div style={{ fontSize: 12.5, color: "#3d4a12", lineHeight: 1.5 }}>{aiR.summary}</div>
          </div>

          <div style={{ padding: "20px 16px 10px", fontSize: 14, fontWeight: 700 }}>สมรรถนะ (Competency)</div>
          <div style={{ margin: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {aiComps.map((c) => (
              <div key={c.name} style={{ background: "#fff", borderRadius: 16, padding: 15, boxShadow: cardShadowSm }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#17181c", background: "#c0e51f", padding: "3px 10px", borderRadius: 999 }}>
                    {c.weightStr}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 7, fontSize: 12, color: "#5a5d6b", lineHeight: 1.55 }}>
                  <Icon name="checklist" size={16} style={{ color: "#8fb400" }} />
                  {c.indicatorsText}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "20px 16px 10px", fontSize: 14, fontWeight: 700 }}>ตัวชี้วัด (KPI)</div>
          <div style={{ margin: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {aiKpis.map((k) => (
              <div key={k.name} style={{ background: "#fff", borderRadius: 16, padding: 15, boxShadow: cardShadowSm }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{k.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#17181c", background: "#c0e51f", padding: "3px 10px", borderRadius: 999 }}>
                    {k.weightStr}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#8a8d99" }}>เป้าหมาย: {k.target}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: 16,
              padding: "14px 16px",
              background: "#fff",
              borderRadius: 14,
              boxShadow: cardShadowSm,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>น้ำหนักรวม</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: aiTotal === 100 ? "#0f9d6e" : "#f59e0b" }}>{aiTotal}%</span>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "0 16px" }}>
            <button
              onClick={genCriteria}
              style={{
                flex: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "1.5px solid #e2e3ea",
                background: "#fff",
                color: "#5a5d6b",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                padding: "14px 16px",
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              <Icon name="refresh" size={19} />
              สร้างใหม่
            </button>
            <button
              onClick={() => showToast("บันทึกแม่แบบเรียบร้อย")}
              style={{
                flex: 1,
                border: "none",
                background: "#17181c",
                color: "#c0e51f",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 800,
                padding: 14,
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              ใช้แม่แบบนี้
            </button>
          </div>
        </div>
      )}

      {aiR && aiR.type === "draft" && (
        <div style={{ animation: "gvpop .25s ease", padding: "18px 16px 0" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 18, boxShadow: cardShadowSm }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#eef7cc",
                color: "#3d4a12",
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 999,
                marginBottom: 14,
              }}
            >
              <Icon name="workspace_premium" size={16} />
              {aiR.overall}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f9d6e", marginBottom: 8 }}>จุดแข็ง</div>
            {aiR.strengths.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#3a3d47", lineHeight: 1.5, padding: "3px 0" }}>
                <Icon name="add_circle" size={17} style={{ color: "#0f9d6e" }} />
                {t}
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#e8590c", margin: "14px 0 8px" }}>สิ่งที่ควรพัฒนา</div>
            {aiR.improvements.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#3a3d47", lineHeight: 1.5, padding: "3px 0" }}>
                <Icon name="trending_up" size={17} style={{ color: "#e8590c" }} />
                {t}
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 800, color: "#17181c", margin: "14px 0 8px" }}>ข้อเสนอการพัฒนา</div>
            {aiR.development.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#3a3d47", lineHeight: 1.5, padding: "3px 0" }}>
                <Icon name="school" size={17} style={{ color: "#8fb400" }} />
                {t}
              </div>
            ))}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0f1f4", fontSize: 13, color: "#5a5d6b", lineHeight: 1.6 }}>
              {aiR.summary}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button
              onClick={genDraft}
              style={{
                flex: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "1.5px solid #e2e3ea",
                background: "#fff",
                color: "#5a5d6b",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                padding: "14px 16px",
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              <Icon name="refresh" size={19} />
              ร่างใหม่
            </button>
            <button
              onClick={() => showToast("บันทึกความเห็นเรียบร้อย")}
              style={{
                flex: 1,
                border: "none",
                background: "#17181c",
                color: "#c0e51f",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 800,
                padding: 14,
                borderRadius: 14,
                cursor: "pointer",
              }}
            >
              บันทึกความเห็น
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
