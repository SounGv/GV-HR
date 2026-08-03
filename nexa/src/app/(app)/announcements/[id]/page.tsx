import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Pin, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "รายละเอียดประกาศ" };

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("announcement:read");
  const { id } = await params;

  const announcement = await prisma.announcement.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      status: true,
      publishedAt: true,
      authorName: true,
      createdAt: true,
    },
  });

  if (!announcement) notFound();

  const statusLabel = announcement.status === "PUBLISHED" ? "เผยแพร่" : "ฉบับร่าง";
  const publishedText = announcement.publishedAt ? formatDate(announcement.publishedAt) : "ยังไม่เผยแพร่";

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประกาศ", href: "/announcements" }, { label: announcement.title }]}
        backHref="/announcements"
        title={announcement.title}
        description={announcement.authorName ? `โดย ${announcement.authorName}` : "ประกาศจากองค์กร"}
        status={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {announcement.pinned && <Pin className="size-3" />}
            {statusLabel}
          </span>
        }
        actions={
          <Link href="/announcements" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดประกาศ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="ผู้เขียน" value={announcement.authorName || "—"} />
            <InfoRow icon={CalendarDays} label="วันที่เผยแพร่" value={publishedText} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> เนื้อหา
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{announcement.body || "—"}</p>
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(announcement.createdAt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
