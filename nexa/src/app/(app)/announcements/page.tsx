import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { AnnouncementView } from "@/features/announcement/announcement-view";

export const metadata: Metadata = { title: "ประกาศและแจ้งเตือน" };

export default async function AnnouncementsPage() {
  await requirePagePermission("announcement:read");

  return (
    <div className="space-y-6">
      <PageHeader title="ประกาศและแจ้งเตือน" description="ข่าวสารและประกาศจากองค์กร" />
      <AnnouncementView />
    </div>
  );
}
