import type { Metadata } from "next";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน" };

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="ACCOUNT RECOVERY"
        headline={
          <>
            ลืมรหัสผ่าน?
            <br />
            ตั้งใหม่ได้ในไม่กี่ขั้นตอน
          </>
        }
        subtitle="กรอกอีเมลที่ใช้สมัครไว้ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ทันที"
      >
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-center gap-3">
            <Mail className="size-5 text-primary" /> ส่งลิงก์ไปยังอีเมลที่ลงทะเบียนไว้
          </li>
          <li className="flex items-center gap-3">
            <KeyRound className="size-5 text-primary" /> ลิงก์ใช้ได้ครั้งเดียว หมดอายุใน 1 ชั่วโมง
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary" /> เซสชันเดิมทั้งหมดจะถูกออกจากระบบเพื่อความปลอดภัย
          </li>
        </ul>
      </AuthBrandPanel>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold">ลืมรหัสผ่าน</h2>
            <p className="text-sm text-muted-foreground">กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่</p>
          </div>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
