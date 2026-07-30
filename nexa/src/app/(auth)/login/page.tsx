import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck, Clock, BarChart3 } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-500 text-lg font-bold">
            N
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">NEXA</div>
            <div className="text-[11px] tracking-[0.18em] text-slate-400">PEOPLE PLATFORM</div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            ระบบบริหารงานบุคคล
            <br />
            และเงินเดือนสำหรับองค์กร
          </h1>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <Clock className="size-5 text-primary" /> เวลาเข้า-ออกงาน, การลา และ OT ครบวงจร
            </li>
            <li className="flex items-center gap-3">
              <BarChart3 className="size-5 text-primary" /> แดชบอร์ดและรายงานเชิงวิเคราะห์
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" /> ปลอดภัยด้วยระบบสิทธิ์การเข้าถึง (RBAC)
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} NEXA People Platform
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
