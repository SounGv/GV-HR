import { Suspense } from "react";
import type { Metadata } from "next";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่" };

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="ACCOUNT RECOVERY"
        headline={
          <>
            ตั้งรหัสผ่านใหม่
            <br />
            เพื่อกลับเข้าใช้งาน NEXA
          </>
        }
        subtitle="ตั้งรหัสผ่านที่คาดเดายาก และไม่ซ้ำกับบัญชีอื่นของคุณ"
      >
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-center gap-3">
            <Lock className="size-5 text-primary" /> อย่างน้อย 8 ตัวอักษร
          </li>
          <li className="flex items-center gap-3">
            <KeyRound className="size-5 text-primary" /> ลิงก์นี้ใช้ได้เพียงครั้งเดียว
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary" /> เซสชันเดิมทั้งหมดจะถูกออกจากระบบทันทีที่ตั้งรหัสผ่านสำเร็จ
          </li>
        </ul>
      </AuthBrandPanel>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">ตั้งรหัสผ่านใหม่</h2>
            <p className="text-sm text-muted-foreground">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
          </div>
          <Suspense fallback={<div className="h-64" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
