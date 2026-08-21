import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { NotifyForm } from "@/features/notification/notify-form";

export const metadata: Metadata = { title: "ส่งแจ้งเตือน" };

export default async function NewNotificationPage() {
  await requirePagePermission("notification:create");
  return <NotifyForm />;
}
