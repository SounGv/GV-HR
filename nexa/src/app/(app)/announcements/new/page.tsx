import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { AnnouncementFormPage } from "@/features/announcement/announcement-form-page";

export const metadata: Metadata = { title: "สร้างประกาศ" };

export default async function NewAnnouncementPage() {
  await requirePagePermission("announcement:create");
  return <AnnouncementFormPage />;
}
