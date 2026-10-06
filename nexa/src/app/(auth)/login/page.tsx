import { Suspense } from "react";
import type { Metadata } from "next";
import { BrandLogo } from "@/features/auth/brand-logo";
import { LoginForm } from "@/features/auth/login-form";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--login-background)] px-6">
      <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col">
        <BrandLogo className="pt-20" />

        <div className="flex flex-col gap-1 pt-12">
          <h1 className="text-2xl leading-snug font-bold text-[var(--login-text-primary)]">เข้าสู่ระบบ</h1>
          <p className="text-[15px] text-[var(--login-text-secondary)]">ใช้อีเมลบริษัทของคุณ</p>
        </div>

        <div className="pt-6">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
          </Suspense>
        </div>

        <div className="flex-1" />
        <div className="pb-7 text-center text-xs text-[var(--login-text-secondary)]">
          ติดปัญหาเข้าระบบ ติดต่อฝ่ายบุคคล
        </div>
      </div>
    </div>
  );
}
