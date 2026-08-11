import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { MeetingFormPage } from "@/features/meeting/meeting-form-page";

export const metadata: Metadata = { title: "นัดประชุมใหม่" };

export default async function NewMeetingPage() {
  await requirePagePermission("meeting:create");
  return <MeetingFormPage />;
}
