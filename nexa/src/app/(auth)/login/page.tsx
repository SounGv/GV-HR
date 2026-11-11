import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, ScanLine, Sparkles } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
import { LoginClock } from "@/features/auth/login-clock";
import { LoginDial } from "@/features/auth/login-dial";
import { Logo } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

const FACTS = [
  { icon: ScanLine, text: "สแกนเข้างานตามพิกัดสาขา" },
  { icon: CalendarDays, text: "ขอลาและ OT ให้หัวหน้าอนุมัติในแอป" },
  { icon: Sparkles, text: "น้องวีบอทสรุปข้อมูลให้หัวหน้าและ HR" },
];

/**
 * Sign-in. The hero says what GV One is with its own mark drawn large: a
 * clock that checks you in, with น้องวีบอท in front. Light is plain radial
 * gradients (no blur) and only transform / stroke-dashoffset animate, so it
 * stays cheap on mid-range phones. On a phone the hero shrinks to a short
 * header and the form comes first.
 */
export default function LoginPage() {
  return (
    <div className="login-page grid min-h-dvh bg-[#0b1414] lg:grid-cols-[minmax(0,1.3fr)_minmax(460px,0.7fr)]">
      <section className="relative overflow-hidden px-5 pt-6 pb-9 text-white sm:px-10 lg:flex lg:flex-col lg:px-14 lg:py-10">
        <span aria-hidden="true" className="login-glow login-glow-a" />
        <span aria-hidden="true" className="login-glow login-glow-b" />

        <div className="relative flex items-center gap-3">
          <Logo size={64} className="h-auto w-16" />
          <span className="leading-tight">
            <b className="block text-[15px]">GV One HR</b>
            <span className="text-xs text-[#9fb3b1]">Gadget Villa</span>
          </span>
        </div>

        <div className="relative flex items-center gap-10 pt-7 lg:my-auto lg:py-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-end justify-between gap-4">
              <h1 className="text-[34px] leading-[1.22] font-bold tracking-[-0.01em] text-balance text-white sm:text-[44px] xl:text-[60px]">
                ทุกเรื่องของทีม
                <span className="mt-1 block">
                  อยู่ใน{" "}
                  <span className="inline-block rounded-[12px] bg-[#CDEB03] px-3 pb-0.5 text-[#131516] shadow-[0_10px_24px_-12px_rgba(205,235,3,0.6)]">
                    ที่เดียว
                  </span>
                </span>
              </h1>
              <VBot mood="hi" full className="h-[104px] w-[88px] shrink-0 lg:hidden" />
            </div>
            <p className="mt-5 max-w-[460px] text-[15.5px] leading-relaxed text-[#a9bcba] xl:text-[17px]">
              ลงเวลาเข้างาน ขอลา ขอ OT และดูผลประเมิน จากมือถือหรือคอมพิวเตอร์ ด้วยบัญชีเดียว
            </p>
            <ul className="mt-8 hidden space-y-3 lg:block">
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
          <VBot mood="hi" full className="hidden h-[170px] w-[146px] shrink-0 lg:block xl:hidden" />
        </div>

        <p className="relative hidden gap-4 text-xs text-[#6f8583] lg:flex">
          <span>© {new Date().getFullYear()} Gadget Villa</span>
          <span>ข้อมูลของคุณเห็นเฉพาะคนที่มีสิทธิ์</span>
        </p>
      </section>

      <section className="relative flex justify-center bg-[var(--login-page-bg)] px-4 pt-7 pb-10 max-lg:rounded-t-[28px] lg:items-center lg:bg-[radial-gradient(110%_55%_at_100%_0,#e3f5f1_0,rgba(246,247,243,0)_60%),var(--login-page-bg)] lg:px-10">
        <div className="w-full max-w-[400px]">
          <LoginClock />
          <h2 className="mt-3 text-[28px] leading-tight font-bold text-[var(--login-text-primary)]">ยินดีต้อนรับกลับ</h2>
          <p className="mt-1 text-[15px] text-[var(--login-text-secondary)]">เข้าสู่ระบบด้วยอีเมลหรือชื่อผู้ใช้ของคุณ</p>
          <div className="pt-6">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
            </Suspense>
          </div>
          <p className="mt-8 border-t border-[var(--login-card-border)] pt-4 text-[12.5px] text-[var(--login-text-secondary)]">
            ลืมรหัสหรือเข้าระบบไม่ได้ ติดต่อฝ่ายบุคคลของบริษัท
          </p>
        </div>
      </section>
    </div>
  );
}
