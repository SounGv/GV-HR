import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, ScanLine, Sparkles } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
import { LoginClock } from "@/features/auth/login-clock";
import { LoginDial } from "@/features/auth/login-dial";
import { Logo, LogoOnDark } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = {
  title: { absolute: "เข้าสู่ระบบ GV One · ระบบบริหารงานบุคคลและเงินเดือน" },
  description: "เข้าสู่ระบบ GV One เพื่อลงเวลา ขอลา ขอ OT และดูงานของคุณ",
  alternates: { canonical: "/login" },
};

const FACTS = [
  { icon: ScanLine, text: "สแกนเข้างานตามพิกัดสาขา" },
  { icon: CalendarDays, text: "ขอลาและ OT ให้หัวหน้าอนุมัติในแอป" },
  { icon: Sparkles, text: "น้องวีบอทสรุปข้อมูลให้หัวหน้าและ HR" },
];

/**
 * Sign-in, one form and two looks. Below 1024px (phones, tablets) it is the minimal liquid glass: one glass card on a soft green ground
 * with น้องวีบอท waving over its top edge. From 1024px up it is the original website layout: a dark hero on the left with the large
 * check-in clock and น้องวีบอท, and a plain light panel with the live Bangkok time and the form on the right. The form is rendered once,
 * so there are no duplicate fields; the pieces that belong to only one look are hidden with `lg:` classes and the glass card is
 * flattened by the `.gv-login-card` rule in globals.css at that width. Only the glass card, the greeting bubble (phone) and transforms
 * animate, so it stays cheap on mid-range phones and holds still when the device asks for less motion.
 */
export default function LoginPage() {
  return (
    <div className="login-page gv-login-bg gv-login-scope relative min-h-dvh overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(460px,0.7fr)]">
      <span aria-hidden="true" className="gv-orb gv-orb-a" />
      <span aria-hidden="true" className="gv-orb gv-orb-b" />
      <span aria-hidden="true" className="gv-orb gv-orb-c" />

      {/* Website only: the dark hero with the clock. */}
      <section className="relative hidden overflow-hidden px-14 py-10 text-white lg:flex lg:flex-col">
        <span aria-hidden="true" className="login-glow login-glow-a" />
        <span aria-hidden="true" className="login-glow login-glow-b" />


        <div className="relative my-auto flex items-center gap-10 py-10">
          <div className="min-w-0 flex-1">
            {/* The company logo and name, with its background removed, sits right above the headline as one block. */}
            <LogoOnDark height={150} className="mb-7" />
            <h1 className="text-[44px] leading-[1.25] font-bold tracking-[-0.01em] text-balance text-white xl:text-[60px]">
              ทุกเรื่องของทีม
              <span className="mt-1 block">
                อยู่ใน{" "}
                {/* Padding in em so the tone mark on "ที่" stays inside the pill at every size. */}
                <span className="inline-block rounded-[0.24em] bg-[#CDEB03] px-[0.3em] pt-[0.18em] pb-[0.1em] leading-[1.2] whitespace-nowrap text-[#131516] shadow-[0_10px_24px_-12px_rgba(205,235,3,0.6)]">
                  ที่เดียว
                </span>
              </span>
            </h1>
            <p className="mt-5 max-w-[460px] text-[15.5px] leading-relaxed text-[#a9bcba] xl:text-[17px]">
              ลงเวลาเข้างาน ขอลา ขอ OT และดูผลประเมิน จากมือถือหรือคอมพิวเตอร์ ด้วยบัญชีเดียว
            </p>
            <ul className="mt-8 space-y-3">
              {FACTS.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.text} className="flex items-center gap-3 text-[14.5px] text-[#d5e3e1]">
                    <span className="flex size-8 items-center justify-center rounded-[10px] bg-white/[0.06] ring-1 ring-white/10">
                      <Icon className="size-4 text-[#2dd4bf]" aria-hidden="true" />
                    </span>
                    {f.text}
                  </li>
                );
              })}
            </ul>
          </div>
          <LoginDial className="hidden w-[min(40%,420px)] shrink-0 xl:block" />
          <VBot mood="hi" full className="h-[170px] w-[146px] shrink-0 xl:hidden" />
        </div>

        <p className="relative flex gap-4 text-xs text-[#6f8583]">
          <span>© {new Date().getFullYear()} Gadget Villa</span>
          <span>ข้อมูลของคุณเห็นเฉพาะคนที่มีสิทธิ์</span>
        </p>
      </section>

      {/* The form: the glass card on a phone, the light panel on the website. The panel stays light in dark mode, so `.gv-login-panel` in globals.css fixes its tokens. */}
      <section className="gv-login-panel relative z-10 flex min-h-dvh flex-col items-center justify-center px-[18px] pt-[calc(env(safe-area-inset-top)+7rem)] pb-[calc(env(safe-area-inset-bottom)+4rem)] sm:pt-40 lg:min-h-0 lg:px-10 lg:py-10">
        <div className="relative z-10 w-full max-w-[400px]">
          {/* Phone only. Behind the card: only the head and the waving hand show above it, the rest is seen blurred through the glass. */}
          <div aria-hidden="true" className="pointer-events-none absolute right-[18px] bottom-[calc(100%-26px)] z-0 sm:right-[22px] lg:hidden">
            <span className="gv-login-bubble absolute right-[104px] bottom-[calc(100%-28px)] rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[var(--login-text-primary)] sm:right-[130px] sm:text-sm">
              สวัสดี มาเริ่มงานกันเลย
            </span>
            <div className="gv-login-bot">
              <VBot mood="hi" full className="h-auto w-[112px] sm:w-[150px]" />
            </div>
          </div>

          <div className="gv-login-card relative z-10 px-5 pt-6 pb-5 sm:px-[26px] sm:pt-7 lg:px-0 lg:pt-0 lg:pb-0">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <Logo size={52} className="h-auto w-[52px]" />
              <span className="leading-tight">
                <b className="block text-[17px] text-[var(--login-text-primary)]">GV One</b>
                <span className="text-xs text-[var(--login-text-secondary)]">Gadget Villa</span>
              </span>
            </div>
            <div className="hidden lg:block">
              <LoginClock />
            </div>
            <h2 className="text-2xl leading-snug font-bold text-[var(--login-text-primary)] sm:text-[26px] lg:mt-3 lg:text-[28px]">ยินดีต้อนรับกลับ</h2>
            <p className="mt-0.5 text-sm text-[var(--login-text-secondary)] lg:text-[15px]">เข้าสู่ระบบด้วยอีเมลหรือชื่อผู้ใช้ของคุณ</p>
            <div className="pt-4 lg:pt-6">
              <Suspense fallback={<div className="h-64" />}>
                <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
              </Suspense>
            </div>
            <p className="mt-4 border-t border-[var(--login-text-secondary)]/20 pt-3 text-center text-xs text-[var(--login-text-secondary)] lg:mt-8 lg:pt-4 lg:text-left lg:text-[12.5px]">
              ลืมรหัสหรือเข้าระบบไม่ได้ ติดต่อฝ่ายบุคคลของบริษัท
            </p>
          </div>
        </div>

        <p className="absolute right-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-0 z-10 px-4 text-center text-[13px] text-[var(--login-text-secondary)] lg:hidden">
          ลงเวลา ขอลา ขอ OT และดูผลประเมิน ในที่เดียว
        </p>
      </section>
    </div>
  );
}
