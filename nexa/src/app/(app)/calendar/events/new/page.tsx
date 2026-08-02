import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { EventFormPage } from "@/features/calendar/event-form-page";

export const metadata: Metadata = { title: "เพิ่มกิจกรรม" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requirePagePermission("calendar:create");
  const { date } = await searchParams;
  return <EventFormPage defaultDate={date} />;
}
