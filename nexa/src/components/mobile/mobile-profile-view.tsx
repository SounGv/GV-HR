"use client";



import Link from "next/link";

import {

  Bell,

  Globe,

  Pencil,

  ShieldCheck,

  LogOut,

  User,

} from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";

import { fullName } from "@/lib/format";

import { useMyProfile } from "@/features/profile/hooks";

import { MobileScreen } from "./mobile-screen";

import { MobileModuleCard } from "./mobile-ui";



export function MobileProfileView() {

  const { user, logout } = useAuth();

  const { data: profileData } = useMyProfile();

  const profile = profileData?.data;



  const addressSummary = profile
    ? [profile.district, profile.province].filter(Boolean).join(", ") || profile.addressLine || null
    : null;

  const emergencyContact = profile?.emergencyContactName
    ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}`
    : profile?.emergencyContactPhone ?? null;



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

        <a
          href="#profile-form"
          className="mx-auto mb-2.5 flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary"
          aria-label="แก้ไขรูปโปรไฟล์"
        >
          {user.employee?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.employee.avatarUrl} alt={displayName} className="size-full object-cover" />
          ) : (
            <User className="size-7 text-primary-foreground" />
          )}
        </a>

        <p className="text-[15px] font-bold text-foreground">{displayName}</p>

        <p className="text-xs text-muted-foreground">{subtitle}</p>

      </MobileModuleCard>



      <MobileModuleCard className="overflow-hidden p-0">

        <div className="flex justify-between border-b border-border px-3.5 py-3 text-[13px]">

          <span className="shrink-0 text-muted-foreground">ที่อยู่</span>

          <span className="ml-3 truncate text-right">{addressSummary ?? "—"}</span>

        </div>

        <div className="flex justify-between border-b border-border px-3.5 py-3 text-[13px]">

          <span className="shrink-0 text-muted-foreground">ผู้ติดต่อฉุกเฉิน</span>

          <span className="ml-3 truncate text-right">{emergencyContact ?? "—"}</span>

        </div>

        <div className="flex justify-between px-3.5 py-3 text-[13px]">

          <span className="text-muted-foreground">อีเมล</span>

          <span>{user.email}</span>

        </div>

      </MobileModuleCard>



      <MobileModuleCard className="overflow-hidden p-0">

        <a

          href="#profile-form"

          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <Pencil className="size-[18px] text-primary" />

          แก้ไขโปรไฟล์ / รูปประจำตัว

        </a>

        <a

          href="#security"

          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <ShieldCheck className="size-[18px] text-primary" />

          ความปลอดภัย (รหัสผ่าน, 2FA)

        </a>

        <Link

          href="/notifications"

          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"

        >

          <Bell className="size-[18px] text-primary" />

          การแจ้งเตือน

        </Link>

        <div className="flex items-center gap-2.5 px-3.5 py-3 text-[13px] text-muted-foreground">

          <Globe className="size-[18px]" />

          ภาษา — ไทย

        </div>

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


