import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/shared/page-header";
import { SelfProfileForm } from "@/features/profile/self-profile-form";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="โปรไฟล์ของฉัน" description="จัดการข้อมูลส่วนตัว รูปโปรไฟล์ บัญชีธนาคาร และผู้ติดต่อฉุกเฉิน" />
      <SelfProfileForm />
    </div>
  );
}
