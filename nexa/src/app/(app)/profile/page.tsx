import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MobileProfilePage } from "@/components/mobile/mobile-profile-page";
import { PageHeader } from "@/components/shared/page-header";
import { SelfProfileForm } from "@/features/profile/self-profile-form";
import { SessionListView } from "@/features/auth-sessions/session-list-view";
import { TwoFactorSettings } from "@/features/auth-mfa/two-factor-settings";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <MobileProfilePage />
      <div id="profile-form" className="hidden space-y-6 p-4 md:block md:p-0">
        <PageHeader title="โปรไฟล์ของฉัน" description="จัดการข้อมูลส่วนตัว รูปโปรไฟล์ บัญชีธนาคาร และผู้ติดต่อฉุกเฉิน" />
        <SelfProfileForm />
        <div id="security">
          <TwoFactorSettings />
          <SessionListView />
        </div>
      </div>
    </>
  );
}
