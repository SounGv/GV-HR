"use client";

import { useApp } from "@/context/AppContext";
import { BackHeader } from "@/components/BackHeader";
import { cardShadow } from "@/lib/styles";
import { initialsOf, thDate } from "@/lib/format";

const roleLabel: Record<string, string> = {
  employee: "พนักงาน",
  manager: "หัวหน้างาน",
  hr: "ฝ่ายบุคคล",
};

export function Profile() {
  const { state } = useApp();
  const me = state.me;
  if (!me) return null;

  const initials = initialsOf(me.name);
  const rows = [
    { label: "รหัสพนักงาน", value: me.employeeCode },
    { label: "แผนก", value: me.department },
    { label: "ตำแหน่ง", value: me.position },
    { label: "สิทธิ์การใช้งาน", value: roleLabel[me.role] || me.role },
    { label: "วันเริ่มงาน", value: me.startDate ? thDate(me.startDate) : "—" },
    { label: "อีเมล", value: me.email },
    { label: "เบอร์โทร", value: me.phone || "—" },
  ];

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
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 12 }}>{me.name}</div>
        <div style={{ fontSize: 13, color: "#8a8d99" }}>{me.position}</div>
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
