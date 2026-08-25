import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { LoginForm } from "@/features/auth/login-form";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";
import { Logo } from "@/components/shared/logo";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel cornerLogo={false}>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/60 blur-3xl" />
            <div className="relative flex size-40 items-center justify-center rounded-[2rem] bg-white p-4 shadow-2xl">
              <Logo size={128} className="size-32" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-bold tracking-wide">GV ONE</div>
            <div className="mt-2 text-sm tracking-[0.25em] text-slate-400">AI WORKFORCE PLATFORM</div>
          </div>
        </div>
      </AuthBrandPanel>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-2 lg:hidden">
            <Logo size={64} className="size-16 rounded-2xl" />
            <div className="text-center leading-tight">
              <div className="text-lg font-bold tracking-wide">GV ONE</div>
              <div className="text-[10px] tracking-[0.18em] text-muted-foreground">AI WORKFORCE PLATFORM</div>
            </div>
          </div>

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
            <Link href="/register" className="font-medium text-accent-foreground hover:underline">
              สมัครใช้งาน (สร้างองค์กรใหม่)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
