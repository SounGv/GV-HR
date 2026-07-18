"use client";

import { BackHeader } from "@/components/BackHeader";
import { cardShadow } from "@/lib/styles";
import { employeeDept, employeeName, employeeRole, profileRows } from "@/lib/mock";
import { initialsOf } from "@/lib/format";

export function Profile() {
  const initials = initialsOf(employeeName);
  const rows = profileRows(employeeDept);

  return (
    <div style={{ animation: "gvslide .28s ease", paddingBottom: 16 }}>
      <BackHeader title="โปรไฟล์" />
      <div style={{ textAlign: "center", padding: "8px 16px 20px" }}>
        <div
          style={{
            width: 88,
            height: 88,
            margin: "0 auto",
            borderRadius: "50%",
            background: "linear-gradient(140deg,#17181c,#3a3c46)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 30,
          }}
        >
          {initials}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>{employeeName}</div>
        <div style={{ fontSize: 13, color: "#8a8d99" }}>{employeeRole}</div>
      </div>
      <div style={{ margin: "0 16px", background: "#fff", borderRadius: 18, padding: "6px 16px", boxShadow: cardShadow }}>
        {rows.map((p) => (
          <div
            key={p.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "13px 0",
              borderBottom: "1px solid #f2f3f6",
              fontSize: 13,
            }}
          >
            <span style={{ color: "#8a8d99" }}>{p.label}</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
