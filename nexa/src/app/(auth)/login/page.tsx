import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { BrandLogo } from "@/features/auth/brand-logo";
import { LoginCard } from "@/features/auth/login-card";
import { LoginForm } from "@/features/auth/login-form";
import { LoginHelpText } from "@/features/auth/login-help-text";
import { isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";

export const metadata: Metadata = { title: { absolute: "เข้าสู่ระบบ · Gadget Villa" } };

/**
 * Loaded directly here rather than relying on the app-wide --font-sans
 * chain: that chain currently falls back to the browser's serif default
 * everywhere in the app (a pre-existing bug in globals.css's @theme block,
 * unrelated to this page — see PR notes), so the login page brings its own
 * fonts to guarantee it renders as specified regardless.
 */
const notoSansThai = Noto_Sans_Thai({ variable: "--login-font-thai", subsets: ["thai"], weight: ["400", "500", "600", "700"], display: "swap" });
const inter = Inter({ variable: "--login-font-latin", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export default function LoginPage() {
  return (
    <div
      className={`${notoSansThai.variable} ${inter.variable} relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--login-background)] px-5 py-10`}
      style={{ fontFamily: "var(--login-font-latin), var(--login-font-thai), system-ui, sans-serif" }}
    >
      {/* Thin decorative curves — kept minimal per the reference design. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 500"
        className="pointer-events-none absolute bottom-0 left-0 h-[45vh] w-full opacity-70"
        preserveAspectRatio="xMidYMax slice"
      >
        <path
          d="M-50 420 C 200 340, 350 480, 600 400 S 950 320, 1050 380"
          fill="none"
          stroke="var(--login-brand-lime-light)"
          strokeWidth="3"
        />
        <path
          d="M-50 470 C 220 400, 380 500, 640 440 S 960 380, 1050 430"
          fill="none"
          stroke="var(--login-brand-lime)"
          strokeWidth="2"
          opacity="0.35"
        />
      </svg>

      <LoginCard className="z-10">
        <div className="space-y-6">
          <BrandLogo />

          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-bold text-[var(--login-text-primary)]">ยินดีต้อนรับกลับ</h2>
            <p className="text-sm text-[var(--login-text-secondary)]">เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน</p>
          </div>

          <Suspense fallback={<div className="h-64" />}>
            <LoginForm googleEnabled={isGoogleOAuthEnabled()} />
          </Suspense>

          <LoginHelpText />
        </div>
      </LoginCard>
    </div>
  );
}
