"use client";

import { LogOut, Lock, UserRound, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { useMyProfile } from "@/features/profile/hooks";
import { fullName, getInitials } from "@/lib/format";
import { MobileScreen } from "./mobile-screen";
import { MobileListGroup, MobileListRow } from "./mobile-list-group";
import { MobilePrimaryButton } from "./mobile-action-footer";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "ทำงานอยู่",
  PROBATION: "ทดลองงาน",
  SUSPENDED: "พักงาน",
  TERMINATED: "พ้นสภาพ",
};

export function MobileProfileView({
  onOpenForm,
  onOpenSecurity,
}: {
  onOpenForm: () => void;
  onOpenSecurity: () => void;
}) {
  const { user, logout } = useAuth();
  const { data, isLoading, isError, refetch } = useMyProfile();
  const profile = data?.data;

  if (isError) {
    return (
      <MobileScreen title="โปรไฟล์" backHref="/dashboard">
        <ErrorState onRetry={() => refetch()} />
      </MobileScreen>
    );
  }

  if (isLoading || !profile) {
    return (
      <MobileScreen title="โปรไฟล์" backHref="/dashboard">
        <TableLoadingState rows={6} />
      </MobileScreen>
    );
  }

  const name = fullName(profile.firstName, profile.lastName) || user.email;
  const subtitle = [profile.position?.title, profile.department?.name].filter(Boolean).join(" · ");

  return (
    <MobileScreen title="โปรไฟล์" backHref="/dashboard" contentClassName="space-y-4 pb-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-primary px-4 py-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-white/30">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={name} />
              <AvatarFallback className="bg-white/20 text-lg text-white">
                {getInitials(profile.firstName, profile.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{name}</p>
              {profile.nickname ? <p className="text-sm opacity-90">({profile.nickname})</p> : null}
              {subtitle ? <p className="mt-0.5 truncate text-xs opacity-80">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-center">
          <div className="px-3 py-3">
            <p className="text-[11px] text-muted-foreground">รหัสพนักงาน</p>
            <p className="text-sm font-semibold text-foreground">{profile.employeeCode}</p>
          </div>
          <div className="px-3 py-3">
            <p className="text-[11px] text-muted-foreground">สถานะ</p>
            <p className="text-sm font-semibold text-foreground">{STATUS_LABEL[profile.status] ?? profile.status}</p>
          </div>
        </div>
      </div>

      <MobileListGroup>
        <MobileListRow icon={UserRound} label="ข้อมูลส่วนตัว" description="แก้ไขโปรไฟล์ ที่อยู่ บัญชีธนาคาร" onClick={onOpenForm} />
        <MobileListRow icon={Lock} label="ความปลอดภัย" description="2FA และอุปกรณ์ที่เข้าสู่ระบบ" onClick={onOpenSecurity} trailing={<ChevronRight className="size-4 text-muted-foreground" />} />
      </MobileListGroup>

      <MobilePrimaryButton variant="outline" className="border-destructive/30 text-destructive" onClick={() => logout()}>
        <LogOut className="mr-2 size-4" />
        ออกจากระบบ
      </MobilePrimaryButton>
    </MobileScreen>
  );
}
