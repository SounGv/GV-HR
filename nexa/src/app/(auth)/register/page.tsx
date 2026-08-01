import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Users, ShieldCheck } from "lucide-react";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "สมัครใช้งาน" };

export default function RegisterPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/25 blur-[110px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-blue-500/15 blur-[120px]" />

        <Link href="/login" className="relative flex items-center gap-3">
          <img src="/nexa-logo.svg" alt="NEXA" className="size-12 rounded-2xl shadow-lg shadow-black/30" />
          <div className="leading-tight">
            <div className="font-semibold tracking-wide">NEXA</div>
            <div className="text-[11px] tracking-[0.18em] text-slate-400">HR AI PLATFORM</div>
          </div>
        </Link>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            เริ่มต้นใช้งานฟรี
            <br />
            สร้างองค์กรของคุณใน 1 นาที
          </h1>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <Building2 className="size-5 text-primary" /> สร้างองค์กรใหม่ พร้อมระบบ HR ครบ 21 โมดูล
            </li>
            <li className="flex items-center gap-3">
              <Users className="size-5 text-primary" /> คุณเป็น Super Admin จัดการทุกอย่างได้ทันที
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary" /> ข้อมูลแยกเป็นสัดส่วน ปลอดภัยด้วย RBAC
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">© {new Date().getFullYear()} NEXA People Platform</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">สมัครใช้งาน</h2>
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
