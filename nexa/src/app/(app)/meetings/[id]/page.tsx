import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { MeetingDetailView } from "@/features/meeting/meeting-detail-view";

export const metadata: Metadata = { title: "รายละเอียดการประชุม" };

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("meeting:read");
  const { id } = await params;
  return <MeetingDetailView id={id} />;
}
