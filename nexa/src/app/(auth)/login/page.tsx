import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarCheck, ClipboardCheck, Clock } from "lucide-react";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { BrandLogo } from "@/features/auth/brand-logo";
import { LoginForm } from "@/features/auth/login-form";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="GADGET VILLA"
        headline={
          <>
            งานบุคคลทั้งหมด
            <br />
            อยู่ในที่เดียว
          </>
        }
        subtitle="ลงเวลา ขอลา ขอ OT และดูผลประเมินของคุณได้จากระบบเดียว"
      >
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-center gap-3">
            <Clock className="size-5 text-primary" aria-hidden="true" /> ลงเวลาเข้า-ออกงานและแก้ไขเวลา
          </li>
          <li className="flex items-center gap-3">
            <CalendarCheck className="size-5 text-primary" aria-hidden="true" /> ขอลา ขอ OT และติดตามสถานะการอนุมัติ
          </li>
          <li className="flex items-center gap-3">
            <ClipboardCheck className="size-5 text-primary" aria-hidden="true" /> ทำแบบประเมินและดูผลของตัวเอง
          </li>
        </ul>
      </AuthBrandPanel>

      <div className="flex min-h-screen flex-col bg-[var(--login-background)] px-6 lg:min-h-0 lg:items-center lg:justify-center">
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col lg:flex-none">
          <BrandLogo className="pt-20 lg:hidden" />

          <div className="flex flex-col gap-1 pt-12 lg:pt-0">
            <h1 className="text-2xl leading-snug font-bold text-[var(--login-text-primary)]">เข้าสู่ระบบ</h1>
            <p className="text-[15px] text-[var(--login-text-secondary)]">ใช้อีเมลหรือชื่อผู้ใช้ของคุณ</p>
          </div>

          <div className="pt-6">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
            </Suspense>
          </div>

          <div className="flex-1 lg:hidden" />
          <div className="pt-10 pb-7 text-center text-xs text-[var(--login-text-secondary)] lg:hidden">
            © {new Date().getFullYear()} Gadget Villa
          </div>
        </div>
      </div>
    </div>
  );
}
