import { Suspense } from "react";
import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { BrandLogo } from "@/features/auth/brand-logo";
import { LoginForm } from "@/features/auth/login-form";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

/**
 * Loaded directly here rather than relying on the app-wide --font-sans
 * chain: that chain currently falls back to the browser's serif default
 * everywhere in the app (a pre-existing bug in globals.css's @theme block,
 * unrelated to this page — see PR notes), so the login page brings its own
 * font to guarantee it renders as specified regardless.
 */
const plexSansThai = IBM_Plex_Sans_Thai({
  variable: "--login-font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function LoginPage() {
  return (
    <div
      className={`${plexSansThai.variable} flex min-h-screen flex-col bg-[var(--login-background)] px-6`}
      style={{ fontFamily: "var(--login-font-thai), system-ui, sans-serif" }}
    >
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
