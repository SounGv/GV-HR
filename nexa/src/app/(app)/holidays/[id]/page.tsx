import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, CalendarDays, FileText, Sparkles } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "รายละเอียดวันหยุด" };

export default async function HolidayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("holiday:read");
  const { id } = await params;

  const holiday = await prisma.holiday.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      date: true,
      type: true,
      notifyEnabled: true,
      createdAt: true,
    },
  });

  if (!holiday) notFound();

  const typeLabel = holiday.type === "NATIONAL" ? "วันหยุดราชการ" : "วันหยุดบริษัท";
  const notifyLabel = holiday.notifyEnabled ? "เปิดแจ้งเตือน" : "ปิดแจ้งเตือน";

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "วันหยุด", href: "/holidays" }, { label: holiday.name }]}
        backHref="/holidays"
        title={holiday.name}
        description={typeLabel}
        status={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3" />
            {typeLabel}
          </span>
        }
        actions={
          <Link href="/holidays" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดวันหยุด</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={CalendarDays} label="วันที่" value={formatDate(holiday.date)} />
            <InfoRow icon={Bell} label="แจ้งเตือน" value={notifyLabel} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> หมายเหตุ
            </div>
            <p className="mt-2 text-sm text-muted-foreground">วันหยุดนี้ถูกกำหนดไว้ในปฏิทินขององค์กร</p>
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(holiday.createdAt)}</p>
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
