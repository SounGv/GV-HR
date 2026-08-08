import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationListView } from "@/features/notification/notification-list-view";

export const metadata: Metadata = { title: "การแจ้งเตือน" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader title="การแจ้งเตือน" description="ความเคลื่อนไหวและอัปเดตล่าสุดของคุณ" />
      <NotificationListView />
    </div>
  );
}
