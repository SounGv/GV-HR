import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getCourse } from "@/features/training/service";
import { CourseFormPage } from "@/features/training/course-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขหลักสูตร" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("training:update");
  const { id } = await params;

  const c = await getCourse(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <CourseFormPage
      course={{
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        provider: c.provider,
        hours: Number(c.hours),
        location: c.location,
        scheduledDate: c.scheduledDate ? c.scheduledDate.toISOString() : null,
        capacity: c.capacity,
        status: c.status,
      }}
    />
  );
}
