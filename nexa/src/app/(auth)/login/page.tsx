import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { Logo } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = {
  title: { absolute: "เข้าสู่ระบบ GV One · ระบบบริหารงานบุคคลและเงินเดือน" },
  description: "เข้าสู่ระบบ GV One เพื่อลงเวลา ขอลา ขอ OT และดูงานของคุณ",
  alternates: { canonical: "/login" },
};

/**
 * Sign-in, minimal liquid glass (mock approved 17 Nov 2026): one glass card on a soft green ground, น้องวีบอท waving over its top edge.
 * Only the card and the greeting bubble blur; the three glows move with transform alone, so it stays cheap on mid-range phones and
 * stops moving when the device asks for less motion.
 */
export default function LoginPage() {
  return (
    <div className="login-page gv-login-bg gv-login-scope relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-[18px] pt-[calc(env(safe-area-inset-top)+7rem)] pb-[calc(env(safe-area-inset-bottom)+4rem)] sm:pt-40">
      <span aria-hidden="true" className="gv-orb gv-orb-a" />
      <span aria-hidden="true" className="gv-orb gv-orb-b" />
      <span aria-hidden="true" className="gv-orb gv-orb-c" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Behind the card: only the head and the waving hand show above it, the rest is seen blurred through the glass. */}
        <div aria-hidden="true" className="pointer-events-none absolute right-[18px] bottom-[calc(100%-26px)] z-0 sm:right-[22px]">
          <span className="gv-login-bubble absolute right-[104px] bottom-[calc(100%-28px)] rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[var(--login-text-primary)] sm:right-[130px] sm:text-sm">
            สวัสดี มาเริ่มงานกันเลย
          </span>
          <div className="gv-login-bot">
            <VBot mood="hi" full className="h-auto w-[112px] sm:w-[150px]" />
          </div>
        </div>

        <div className="gv-login-card relative z-10 px-5 pt-6 pb-5 sm:px-[26px] sm:pt-7">
          <div className="mb-4 flex items-center gap-3">
            <Logo size={52} className="h-auto w-[52px]" />
            <span className="leading-tight">
              <b className="block text-[17px] text-[var(--login-text-primary)]">GV One</b>
              <span className="text-xs text-[var(--login-text-secondary)]">Gadget Villa</span>
            </span>
          </div>
          <h1 className="text-2xl leading-snug font-bold text-[var(--login-text-primary)] sm:text-[26px]">ยินดีต้อนรับกลับ</h1>
          <p className="mt-0.5 text-sm text-[var(--login-text-secondary)]">เข้าสู่ระบบด้วยอีเมลหรือชื่อผู้ใช้ของคุณ</p>
          <div className="pt-4">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
            </Suspense>
          </div>
          <p className="mt-4 border-t border-[var(--login-text-secondary)]/20 pt-3 text-center text-xs text-[var(--login-text-secondary)]">
            ลืมรหัสหรือเข้าระบบไม่ได้ ติดต่อฝ่ายบุคคลของบริษัท
          </p>
        </div>
      </div>

      <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-0 right-0 z-10 px-4 text-center text-[13px] text-[var(--login-text-secondary)]">
        ลงเวลา ขอลา ขอ OT และดูผลประเมิน ในที่เดียว
      </p>
    </div>
  );
}
