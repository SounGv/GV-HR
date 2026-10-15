import { Suspense } from "react";
import type { Metadata } from "next";
import { BrandLogo } from "@/features/auth/brand-logo";
import { LoginForm } from "@/features/auth/login-form";
import { Logo } from "@/components/shared/logo";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--login-page-bg)] px-4 py-10 max-sm:bg-[var(--login-background)]">
      {/* The card is a card from sm up; on a phone the form simply fills the screen. */}
      <div className="w-full max-w-[440px] sm:rounded-[28px] sm:border sm:border-[var(--login-card-border)] sm:bg-[var(--login-background)] sm:p-9 sm:shadow-[var(--login-card-shadow)]">
        <BrandLogo className="sm:hidden" />
        <div className="hidden justify-center sm:flex">
          <Logo size={140} className="h-auto w-[140px] drop-shadow-[0_8px_10px_var(--login-logo-shadow)]" />
        </div>

        <div className="flex flex-col gap-1 pt-10 sm:pt-7">
          <h1 className="text-2xl leading-snug font-bold text-[var(--login-text-primary)]">เข้าสู่ระบบ</h1>
          <p className="text-[15px] text-[var(--login-text-secondary)]">ใช้อีเมลหรือชื่อผู้ใช้ของคุณ</p>
        </div>

        <div className="pt-6">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
          </Suspense>
        </div>
      </div>

      <p className="pt-8 text-xs text-[var(--login-text-secondary)]">© {new Date().getFullYear()} Gadget Villa</p>
    </div>
  );
}
