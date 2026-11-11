import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarDays, ScanLine, Sparkles } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";
import { Logo } from "@/components/shared/logo";
import { VBot } from "@/components/shared/v-bot";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

const FEATURES = [
  { icon: ScanLine, title: "สแกนเข้างาน", text: "เช็คพิกัดสาขาให้อัตโนมัติ" },
  { icon: CalendarDays, title: "ลาและ OT", text: "ส่งคำขอ หัวหน้าอนุมัติในแอป" },
  { icon: Sparkles, title: "ผู้ช่วย AI", text: "สรุปจากข้อมูลจริง สำหรับหัวหน้าและ HR" },
];

/**
 * Sign-in: a dark teal hero on the left (soft light from plain radial
 * gradients that only move by transform, so it stays cheap) and the form card
 * on the right. On a phone the hero shrinks to a short header above the card.
 */
export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-[#0b1414] lg:grid-cols-[minmax(0,1.1fr)_minmax(460px,0.9fr)]">
      <section className="relative overflow-hidden px-5 pt-6 pb-8 text-white sm:px-10 lg:flex lg:flex-col lg:px-14 lg:py-9">
        <span aria-hidden="true" className="login-glow login-glow-a" />
        <span aria-hidden="true" className="login-glow login-glow-b" />
        <span aria-hidden="true" className="login-grid" />

        <div className="relative flex items-center gap-3">
          <Logo size={64} className="h-auto w-16" />
          <span className="leading-tight">
            <b className="block text-[15px]">GV One HR</b>
            <span className="text-xs text-[#9fb3b1]">Gadget Villa</span>
          </span>
        </div>

        <div className="relative max-w-[560px] pt-8 lg:my-auto lg:py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-3 pl-1 text-[12.5px] text-[#d5e3e1]">
            <span className="rounded-full bg-[#0d9488] px-2 text-[11px] font-semibold text-white">GV One</span>
            ใช้ได้ทั้งมือถือและคอมพิวเตอร์
          </span>
          <div className="flex items-end gap-4">
            <h1 className="mt-4 text-[30px] leading-[1.3] font-bold text-white lg:text-[44px]">
              ทุกเรื่องของทีม
              <span className="block bg-[linear-gradient(90deg,#5eead4,#2dd4bf_40%,#99f6e4)] bg-clip-text text-transparent">
                อยู่ในที่เดียว
              </span>
            </h1>
            <VBot mood="hi" full className="mb-1 hidden h-[118px] w-[100px] lg:block" />
          </div>
          <p className="mt-3 max-w-[470px] text-[15px] text-[#9fb3b1] lg:text-[15.5px]">
            ลงเวลาเข้างาน ขอลา ขอ OT และดูผลประเมิน ได้ทั้งบนมือถือและคอมพิวเตอร์
          </p>
          <ul className="mt-7 hidden grid-cols-3 gap-2.5 lg:grid">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li
                  key={f.title}
                  className="rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]"
                >
                  <Icon className="size-[18px] text-[#2dd4bf]" aria-hidden="true" />
                  <b className="mt-1.5 block text-[13.5px]">{f.title}</b>
                  <span className="block text-xs leading-snug text-[#9fb3b1]">{f.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative hidden gap-4 text-xs text-[#6f8583] lg:flex">
          <span>© {new Date().getFullYear()} Gadget Villa</span>
          <span>ข้อมูลของคุณเห็นเฉพาะคนที่มีสิทธิ์</span>
        </p>
      </section>

      <section className="flex justify-center px-4 pb-10 lg:items-center lg:bg-[radial-gradient(120%_60%_at_100%_0,#e7f6f3_0,rgba(245,246,247,0)_60%),var(--login-page-bg)] lg:px-6 lg:py-10">
        <div className="w-full max-w-[420px] self-start rounded-[20px] border border-[var(--login-card-border)] bg-[var(--login-background)] p-6 shadow-[0_1px_2px_rgba(19,21,22,.06),0_24px_48px_-28px_rgba(19,21,22,.3)] sm:p-7 lg:self-center">
          <h2 className="text-[22px] leading-snug font-bold text-[var(--login-text-primary)]">เข้าสู่ระบบ</h2>
          <p className="text-sm text-[var(--login-text-secondary)]">ใช้อีเมลหรือชื่อผู้ใช้ของคุณ</p>
          <div className="pt-5">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
            </Suspense>
          </div>
          <p className="pt-5 text-center text-[12.5px] text-[var(--login-text-secondary)]">
            ลืมรหัสหรือเข้าระบบไม่ได้ ติดต่อฝ่ายบุคคล
          </p>
        </div>
      </section>
    </div>
  );
}
