"use client";

import Link from "next/link";
import { Bell, Globe, Pencil, ShieldCheck, LogOut, User, Wallet, ChevronRight } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, formatCurrency, loginIdentifier } from "@/lib/format";
import { useMyProfile } from "@/features/profile/hooks";
import { usePayroll } from "@/features/payroll/hooks";
import { MobileScreen } from "./mobile-screen";
import { MobileModuleCard } from "./mobile-ui";

export function MobileProfileView() {
  const { user, can, logout } = useAuth();
  const { data: profileData } = useMyProfile();
  const profile = profileData?.data;
  const canPayroll = can("payroll:read");
  const { data: payrollData } = usePayroll("me", undefined);
  const latestPayslip = canPayroll ? payrollData?.data?.[0] : null;

  const addressSummary = profile
    ? [profile.district, profile.province].filter(Boolean).join(", ") || profile.addressLine || null
    : null;

  const emergencyContact = profile?.emergencyContactName
    ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` · ${profile.emergencyContactPhone}` : ""}`
    : profile?.emergencyContactPhone ?? null;

  async function handleLogout() {
    await logout();
  }

  const displayName = user.employee ? fullName(user.employee.firstName, user.employee.lastName) : loginIdentifier(user);
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
        {user.email && (
          <div className="flex justify-between border-b border-border px-3.5 py-3 text-[13px]">
            <span className="text-muted-foreground">อีเมล</span>
            <span>{user.email}</span>
          </div>
        )}
        <div className="flex justify-between px-3.5 py-3 text-[13px]">
          <span className="text-muted-foreground">ชื่อผู้ใช้</span>
          <span>{user.username ?? "—"}</span>
        </div>
      </MobileModuleCard>

      {canPayroll && (
        <MobileModuleCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-3 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-2.5">
              <Wallet className="size-[18px]" />
              รายได้และสวัสดิการ{latestPayslip ? ` · ${latestPayslip.periodLabel}` : ""}
            </span>
          </div>
          {latestPayslip ? (
            <>
              {latestPayslip.earnings.map((line) => (
                <div
                  key={line.label}
                  className="flex justify-between border-b border-border px-3.5 py-2.5 text-[13px]"
                >
                  <span className="text-muted-foreground">{line.label}</span>
                  <span>{formatCurrency(line.amount)}</span>
                </div>
              ))}
              {latestPayslip.deductions.length > 0 && (
                <div className="flex justify-between border-b border-border px-3.5 py-2.5 text-[13px]">
                  <span className="text-muted-foreground">รายการหักรวม</span>
                  <span className="text-destructive">-{formatCurrency(latestPayslip.totalDeductions)}</span>
                </div>
              )}
              <Link
                href="/payroll"
                className="flex items-center justify-between px-3.5 py-3 text-[13px] font-semibold active:bg-muted"
              >
                <span>เงินเดือนสุทธิ · ดูสลิปเงินเดือน</span>
                <span className="flex items-center gap-1 text-foreground">
                  {formatCurrency(latestPayslip.net)}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </span>
              </Link>
            </>
          ) : (
            <Link href="/payroll" className="flex items-center justify-between px-3.5 py-3 text-[13px] active:bg-muted">
              <span>ดูสลิปเงินเดือน</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          )}
        </MobileModuleCard>
      )}

      <MobileModuleCard className="overflow-hidden p-0">
        <a
          href="#profile-form"
          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"
        >
          <Pencil className="size-[18px] text-accent-foreground" />
          แก้ไขโปรไฟล์ / รูปประจำตัว
        </a>
        <a
          href="#security"
          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"
        >
          <ShieldCheck className="size-[18px] text-accent-foreground" />
          ความปลอดภัย (รหัสผ่าน, 2FA)
        </a>
        <Link
          href="/notifications"
          className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-[13px] active:bg-muted"
        >
          <Bell className="size-[18px] text-accent-foreground" />
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
