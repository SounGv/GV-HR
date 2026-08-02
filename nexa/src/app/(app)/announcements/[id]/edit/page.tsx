import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { getAnnouncement } from "@/features/announcement/service";
import { AnnouncementFormPage } from "@/features/announcement/announcement-form-page";
import { AppError } from "@/lib/api/errors";

export const metadata: Metadata = { title: "แก้ไขประกาศ" };

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("announcement:update");
  const { id } = await params;

  const a = await getAnnouncement(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  return (
    <AnnouncementFormPage
      announcement={{
        id: a.id,
        title: a.title,
        body: a.body,
        pinned: a.pinned,
        status: a.status,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        authorName: a.authorName,
        createdAt: a.createdAt.toISOString(),
      }}
    />
  );
}
