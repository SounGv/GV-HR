import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getEvent } from "@/features/calendar/service";
import { EventFormPage } from "@/features/calendar/event-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขกิจกรรม" };

function dateStr(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("calendar:update");
  const { id } = await params;

  const e = await getEvent(session.companyId, id).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });

  return (
    <EventFormPage
      event={{
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        startDate: dateStr(e.startDate) ?? "",
        endDate: dateStr(e.endDate),
      }}
    />
  );
}
