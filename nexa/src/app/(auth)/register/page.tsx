import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Users, ShieldCheck } from "lucide-react";
import { AuthBrandPanel } from "@/features/auth/auth-brand-panel";
import { RegisterForm } from "@/features/auth/register-form";
import { MODULES } from "@/config/permissions";

export const metadata: Metadata = { title: "สมัครใช้งาน" };

export default function RegisterPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthBrandPanel
        eyebrow="เริ่มต้นใช้งานฟรี"
        headline={
          <>
            สร้างองค์กรของคุณ
            <br />
            ภายใน 1 นาที
          </>
        }
        subtitle="ระบบ HR ครบวงจร พร้อมใช้งานทันทีที่สมัคร ไม่ต้องติดตั้งอะไรเพิ่ม"
      >
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="flex items-center gap-3">
            <Building2 className="size-5 text-primary" /> สร้างองค์กรใหม่ พร้อมระบบ HR ครบ {MODULES.length}+ โมดูล
          </li>
          <li className="flex items-center gap-3">
            <Users className="size-5 text-primary" /> คุณเป็น Super Admin จัดการทุกอย่างได้ทันที
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary" /> ข้อมูลแยกเป็นสัดส่วน ปลอดภัยด้วย RBAC
          </li>
        </ul>
      </AuthBrandPanel>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold">สมัครใช้งาน</h2>
            <p className="text-sm text-muted-foreground">สร้างองค์กรใหม่และเริ่มใช้ NEXA</p>
          </div>

          <RegisterForm />

          <p className="text-center text-sm text-muted-foreground">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
