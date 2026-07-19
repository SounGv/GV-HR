"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        setLoading(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "radial-gradient(120% 90% at 50% 0%,#eef0f5 0%,#dfe1e9 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#fff",
          borderRadius: 28,
          padding: "36px 28px",
          boxShadow: "0 30px 60px -20px rgba(20,20,50,.35)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: "linear-gradient(140deg,#17181c,#3a3c46)",
            color: "#c0e51f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 22,
            margin: "0 auto 18px",
          }}
        >
          GV
        </div>
        <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800 }}>GV-HR</div>
        <div style={{ textAlign: "center", fontSize: 12, color: "#8a8d99", marginBottom: 26 }}>
          เข้าสู่ระบบพนักงาน Gadget Villa
        </div>

        <form onSubmit={onSubmit}>
          <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>
            รหัสพนักงาน หรือ อีเมล
          </label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="EMP-1042 หรือ natthapong@gadgetvilla.co.th"
            style={{
              width: "100%",
              margin: "6px 0 16px",
              padding: 12,
              border: "1.5px solid #e2e3ea",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          <label style={{ fontSize: 12, color: "#8a8d99", fontWeight: 600 }}>รหัสผ่าน</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: "100%",
              margin: "6px 0 20px",
              padding: 12,
              border: "1.5px solid #e2e3ea",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 14,
            }}
          />
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fdecec",
                color: "#d64545",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 14px",
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <Icon name="error" size={18} />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 16,
              padding: 14,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 800,
              background: loading ? "#e6e7ec" : "#17181c",
              color: loading ? "#a3a6b2" : "#c0e51f",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            fontSize: 11,
            color: "#b6b9c2",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          บัญชีทดลอง: EMP-1042 / Passw0rd!
        </div>
      </div>
    </div>
  );
}
