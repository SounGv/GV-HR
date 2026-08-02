import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getHoliday } from "@/features/holiday/service";
import { HolidayFormPage } from "@/features/holiday/holiday-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขวันหยุด" };

export default async function EditHolidayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("holiday:update");
  const { id } = await params;

  const holiday = await getHoliday(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <HolidayFormPage
      holiday={{
        id: holiday.id,
        date: holiday.date.toISOString(),
        name: holiday.name,
        type: holiday.type,
        notifyEnabled: holiday.notifyEnabled,
      }}
    />
  );
}
