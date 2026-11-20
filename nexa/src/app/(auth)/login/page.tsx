import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { LoginClock } from "@/features/auth/login-clock";

export const metadata: Metadata = {
  title: { absolute: "เข้าสู่ระบบ GV One · ระบบบริหารงานบุคคลและเงินเดือน" },
  description: "เข้าสู่ระบบ GV One เพื่อลงเวลา ขอลา ขอ OT และดูงานของคุณ",
  alternates: { canonical: "/login" },
};

/**
 * Sign-in in the Favpo look (approved mock favpo-style-login-mock.html, 20 Nov 2026): a solid blue panel with the white "GV One"
 * wordmark and a white form beside it (side by side from 1024px, the panel as a band on top below that). Nothing here animates and
 * nothing is blurred, so it stays light on mid-range phones. The old watch, floating bubbles and the waving mascot are gone (the
 * assistant is for managers and HR only), and so is the Google button: LoginForm shows it only when googleEnabled is passed, and
 * this page no longer passes it. The form is the same one as before (username or email, password with show/hide, remember me,
 * forgot password, two-step code).
 */
export default function LoginPage() {
  return (
    <div className="login-page min-h-dvh bg-white lg:grid lg:grid-cols-2">
      <section className="flex min-h-[190px] flex-col items-center justify-center gap-2 bg-[#0d47a1] px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 text-center text-white lg:min-h-dvh">
        <p className="text-[44px] leading-[1.15] font-bold tracking-tight lg:text-[64px]">
          GV One
          <span className="mt-1 block text-xs font-medium tracking-[0.32em] text-white/85 lg:text-sm">GADGET VILLA</span>
        </p>
        <p className="text-[15px] text-white/90 lg:text-base">ระบบบริหารงานบุคคลและเงินเดือน</p>
      </section>

      <section className="gv-login-light flex items-start justify-center px-5 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] lg:items-center lg:px-12 lg:py-10">
        <div className="w-full max-w-[380px]">
          <h1 className="text-2xl leading-snug font-medium text-[var(--login-text-primary)]">เข้าสู่ระบบ GV One</h1>
          <p className="mt-0.5 text-[15px] text-[var(--login-text-secondary)]">ระบบบริหารงานบุคคลและเงินเดือน</p>
          <div className="mt-3">
            <LoginClock />
          </div>
          <div className="pt-4">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-6 text-[13px] text-[var(--login-text-secondary)]">ลืมรหัสหรือเข้าระบบไม่ได้ ติดต่อฝ่ายบุคคลของบริษัท</p>
        </div>
      </section>
    </div>
  );
}
