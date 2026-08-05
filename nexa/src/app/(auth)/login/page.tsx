import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Bot,
  Wallet,
  Target,
  GitBranch,
  BarChart3,
  MapPinned,
  Smartphone,
  Cloud,
  LayoutGrid,
} from "lucide-react";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { LoginForm } from "@/features/auth/login-form";
import { MODULES } from "@/config/permissions";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

const FEATURES = [
  { icon: Bot, label: "AI Assistant", desc: "ผู้ช่วยอัจฉริยะตอบคำถามและช่วยทำงาน 24 ชม.", tone: "bg-primary/15 text-primary" },
  { icon: MapPinned, label: "Smart Attendance", desc: "เช็คอินด้วย GPS + Geofence รองรับ WFH", tone: "bg-success/15 text-success" },
  { icon: Wallet, label: "Payroll Automation", desc: "คำนวณเงินเดือนและรายการหักอัตโนมัติ", tone: "bg-warning/15 text-warning" },
  { icon: Target, label: "Performance & KPI", desc: "ประเมินผลงานด้วย AI ครบในที่เดียว", tone: "bg-violet-500/15 text-violet-400" },
  { icon: GitBranch, label: "Workflow อนุมัติ", desc: "อนุมัติเอกสารหลายขั้นตอนได้ในคลิกเดียว", tone: "bg-info/15 text-info" },
  { icon: BarChart3, label: "AI Analytics", desc: "แดชบอร์ดและรายงานเชิงวิเคราะห์เรียลไทม์", tone: "bg-destructive/15 text-destructive" },
];

const STATS = [
  { icon: LayoutGrid, value: `${MODULES.length}+`, label: "Enterprise Modules" },
  { icon: Bot, value: "AI Native", label: "ขับเคลื่อนด้วย AI" },
  { icon: Smartphone, value: "Mobile First", label: "ใช้งานผ่านมือถือได้เต็มรูปแบบ" },
  { icon: Cloud, value: "Cloud Ready", label: "ปลอดภัย ขยายระบบง่าย" },
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="NEXT GENERATION AI PLATFORM"
        headline={
          <>
            อนาคตของการบริหารองค์กร
            <br />
            เริ่มต้นที่ GV One
          </>
        }
        subtitle="รวมทุกการทำงานขององค์กรไว้ในแพลตฟอร์มเดียว ขับเคลื่อนด้วย AI เพื่อให้คุณทำงานง่ายขึ้น ลัดขั้นตอน และเร็วขึ้น"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
            >
              <span className={`mb-2 flex size-8 items-center justify-center rounded-lg ${f.tone}`}>
                <f.icon className="size-4" />
              </span>
              <p className="text-xs font-semibold text-white">{f.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-5">
          {STATS.map((s) => (
            <div key={s.label} className="space-y-1">
              <s.icon className="size-4 text-primary" />
              <p className="text-sm font-semibold text-white">{s.value}</p>
              <p className="text-[10px] leading-tight text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      </AuthBrandPanel>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold">ยินดีต้อนรับกลับ 👋</h2>
            <p className="text-sm text-muted-foreground">
              เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน GV One
            </p>
          </div>

          <Suspense fallback={<div className="h-64" />}>
            <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
          </Suspense>

          <p className="text-center text-sm text-muted-foreground">
            ยังไม่มีองค์กร?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              สมัครใช้งาน (สร้างองค์กรใหม่)
            </Link>
          </p>

          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">บัญชีทดลอง</p>
            <p>hr@nexa.co.th · manager@nexa.co.th · employee@nexa.co.th</p>
            <p>รหัสผ่าน: Password123!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
