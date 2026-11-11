import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MobileProfilePage } from "@/components/mobile/mobile-profile-page";
import { PageHeader } from "@/components/shared/page-header";
import { SelfProfileForm } from "@/features/profile/self-profile-form";
import { SessionListView } from "@/features/auth-sessions/session-list-view";
import { TwoFactorSettings } from "@/features/auth-mfa/two-factor-settings";
import { ChangePasswordForm } from "@/features/auth-password/change-password-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <MobileProfilePage />
      <div id="profile-form" className="hidden space-y-6 p-4 md:block md:p-0">
        <PageHeader title="โปรไฟล์ของฉัน" description="จัดการข้อมูลส่วนตัว รูปโปรไฟล์ บัญชีธนาคาร และผู้ติดต่อฉุกเฉิน" />
        {user.employee ? (
          <SelfProfileForm />
        ) : (
          // Personal details belong to an employee record; an admin-only login has none (the API answers 400).
          <Card className="gap-1 p-5">
            <p className="text-[15px] font-semibold text-foreground">บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน</p>
            <p className="text-sm text-muted-foreground">
              ข้อมูลส่วนตัว รูปโปรไฟล์ และบัญชีธนาคารเป็นของพนักงานแต่ละคน บัญชีนี้จึงเปลี่ยนได้เฉพาะรหัสผ่านและความปลอดภัยด้านล่าง
            </p>
          </Card>
        )}
        <div id="security" className="space-y-4">
          <ChangePasswordForm />
          <TwoFactorSettings />
          <SessionListView />
        </div>
      </div>
    </>
  );
}
