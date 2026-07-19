"use client";

import { useApp } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { BackHeader } from "@/components/BackHeader";
import { cardShadow } from "@/lib/styles";

export function Performance() {
  const { state } = useApp();
  const perf = state.performance;

  if (!perf) {
    return (
      <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
        <BackHeader title="ผลการปฏิบัติงาน" />
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#b6b9c2" }}>
          <Icon name="trending_up" size={44} />
          <div style={{ fontSize: 13, marginTop: 8 }}>ยังไม่มีรอบประเมินผลงาน</div>
        </div>
      </div>
    );
  }

  const kpis = perf.kpis.map((k) => ({
    ...k,
    pct: ((k.score / 5) * 100).toFixed(0) + "%",
    color: k.score >= 4.2 ? "#0f9d6e" : k.score >= 3.5 ? "#f59e0b" : "#ef4444",
  }));
  const comps = perf.competencies.map((c) => ({
    ...c,
    curPct: (c.cur / 5) * 100 + "%",
    tgtPct: (c.tgt / 5) * 100 + "%",
  }));

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
      <BackHeader title="ผลการปฏิบัติงาน" subtitle={perf.cycle} />

      <div
        style={{
          margin: "0 16px",
          background: "linear-gradient(150deg,#0f9d6e,#0b7d58)",
          borderRadius: 24,
          padding: 22,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            flex: "none",
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(255,255,255,.16)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(255,255,255,.4)",
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{perf.overallScore.toFixed(1)}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>/ 5.0</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>ระดับผลงานโดยรวม</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{perf.band}</div>
        </div>
      </div>

      <div style={{ padding: "20px 16px 8px", fontSize: 14, fontWeight: 700 }}>KPI รายบุคคล</div>
      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 18, padding: "6px 16px", boxShadow: cardShadow }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ padding: "12px 0", borderBottom: "1px solid #f2f3f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{k.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: k.color }}>{k.score}</span>
            </div>
            <div style={{ height: 7, background: "#eef0f4", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: k.pct, background: k.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "20px 16px 8px", fontSize: 14, fontWeight: 700 }}>สมรรถนะ (Competency)</div>
      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 18, padding: "6px 16px", boxShadow: cardShadow }}>
        {comps.map((c) => (
          <div key={c.label} style={{ padding: "12px 0", borderBottom: "1px solid #f2f3f6" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: 12, color: "#8a8d99" }}>
                ปัจจุบัน {c.cur} · เป้า {c.tgt}
              </span>
            </div>
            <div style={{ position: "relative", height: 7, background: "#eef0f4", borderRadius: 99 }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: c.curPct,
                  background: "#17181c",
                  borderRadius: 99,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -3,
                  left: c.tgtPct,
                  width: 3,
                  height: 13,
                  background: "#f59e0b",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {perf.idpTitle && (
        <div style={{ margin: "20px 16px 0", background: "#fff8ec", border: "1px solid #ffe6bf", borderRadius: 18, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#b7791f", marginBottom: 6 }}>
            <Icon name="flag" size={19} />
            แผนพัฒนา (IDP)
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{perf.idpTitle}</div>
          <div style={{ fontSize: 11, color: "#8a8d99", margin: "6px 0 8px" }}>
            {perf.idpDescription} · เป้าหมาย {perf.idpTargetDate}
          </div>
          <div style={{ height: 7, background: "#f3e3c9", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${perf.idpProgressPercent || 0}%`, background: "#f59e0b", borderRadius: 99 }} />
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#b7791f", fontWeight: 700, marginTop: 4 }}>
            ความคืบหน้า {perf.idpProgressPercent || 0}%
          </div>
        </div>
      )}
    </div>
  );
}
