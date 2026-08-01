import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, Clock, BarChart3, Sparkles } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-blue-500/15 blur-[120px]" />

        <div className="relative flex items-center gap-3">
          <img src="/nexa-logo.svg" alt="NEXA" className="size-12 rounded-2xl shadow-lg shadow-black/30" />
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">NEXA</div>
            <div className="text-[11px] tracking-[0.18em] text-slate-400">HR AI PLATFORM</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            <Sparkles className="size-3.5 text-primary" /> AI-First HR Platform
          </span>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            ระบบบริหารงานบุคคล
            <br />
            และเงินเดือน ขับเคลื่อนด้วย AI
          </h1>
          <ul className="space-y-3.5 text-sm text-slate-300">
            {[
              { icon: Clock, text: "เวลาเข้า-ออกงาน, การลา และ OT ครบวงจร" },
              { icon: BarChart3, text: "แดชบอร์ดและรายงานเชิงวิเคราะห์เรียลไทม์" },
              { icon: ShieldCheck, text: "ปลอดภัยด้วยระบบสิทธิ์การเข้าถึง (RBAC)" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                  <Icon className="size-4 text-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} NEXA HR AI Platform
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">ยินดีต้อนรับกลับ</h2>
            <p className="text-sm text-muted-foreground">
              เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน NEXA
            </p>
          </div>

          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
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
