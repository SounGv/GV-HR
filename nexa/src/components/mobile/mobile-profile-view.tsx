"use client";



import {

  Bell,

  Globe,

  IdCard,

  LogOut,

  User,

} from "lucide-react";

import Link from "next/link";

import { useAuth } from "@/features/auth/auth-context";

import { fullName } from "@/lib/format";

import { MobileScreen } from "./mobile-screen";

import { MobileModuleCard } from "./mobile-ui";



export function MobileProfileView() {

  const { user, logout } = useAuth();



  async function handleLogout() {

    await logout();

  }



  const displayName = user.employee

    ? fullName(user.employee.firstName, user.employee.lastName)

    : user.email;

  const subtitle = user.employee

    ? `${user.employee.position?.title ?? "พนักงาน"} • ${user.employee.department?.name ?? "—"}`

    : user.roles.join(", ") || "—";



  return (

    <MobileScreen title="โปรไฟล์" backHref="/services" contentClassName="space-y-3.5 p-3.5">

      <MobileModuleCard className="text-center">

        <div className="mx-auto mb-2.5 flex size-16 items-center justify-center rounded-full bg-accent">

          <User className="size-7 text-primary" />

        </div>

        <p className="text-[15px] font-bold text-foreground">{displayName}</p>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

      </MobileModuleCard>



      <MobileModuleCard className="overflow-hidden p-0">

        <div className="flex justify-between border-b border-border px-3.5 py-3 text-[13px]">

          <span className="text-muted-foreground">ที่อยู่</span>

          <span className="text-right">—</span>

        </div>

        <div className="flex justify-between border-b border-border px-3.5 py-3 text-[13px]">

          <span className="text-muted-foreground">เบอร์ฉุกเฉิน</span>

          <span>—</span>

        </div>

        <div className="flex justify-between px-3.5 py-3 text-[13px]">

          <span className="text-muted-foreground">อีเมล</span>

          <span>{user.email}</span>

        </div>

      </MobileModuleCard>



      <MobileModuleCard className="overflow-hidden p-0">

        <Link

          href="/profile#profile-form"

          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <IdCard className="size-[18px] text-primary" />

          เอกสารประจำตัว

        </Link>

        <Link

          href="/profile#profile-form"

          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <Globe className="size-[18px] text-primary" />

          ภาษา — ไทย

        </Link>

        <Link

          href="/profile#security"

          className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <Bell className="size-[18px] text-primary" />

          การแจ้งเตือน — เปิด

        </Link>

      </MobileModuleCard>



      <button

        type="button"

        onClick={handleLogout}

        className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-destructive/20 bg-destructive-muted px-4 py-3 text-[13px] font-bold text-destructive active:scale-[0.99]"

      >

        <LogOut className="size-4" />

        ออกจากระบบ

      </button>

    </MobileScreen>

  );

}


