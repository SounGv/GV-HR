import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, FileText, MapPin, Users } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "รายละเอียดหลักสูตรฝึกอบรม" };

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("training:read");
  const { id } = await params;

  const course = await prisma.trainingCourse.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      provider: true,
      hours: true,
      location: true,
      scheduledDate: true,
      capacity: true,
      status: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) notFound();

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ฝึกอบรม", href: "/training" }, { label: course.title }]}
        backHref="/training"
        title={course.title}
        description={`${course.category} · ${course.hours} ชม.`}
        status={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {course.status === "OPEN" ? "เปิดรับสมัคร" : "ปิดรับสมัคร"}
          </span>
        }
        actions={
          <Link href="/training" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดหลักสูตรฝึกอบรม</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={Clock3} label="ระยะเวลา" value={`${course.hours} ชั่วโมง`} />
            <InfoRow icon={CalendarDays} label="วันที่จัด" value={course.scheduledDate ? formatDate(course.scheduledDate) : "—"} />
            <InfoRow icon={MapPin} label="สถานที่" value={course.location || "—"} />
            <InfoRow icon={Users} label="ผู้ลงทะเบียน" value={`${course._count.enrollments} คน`} />
            <InfoRow label="ความจุ" value={course.capacity != null ? `${course.capacity} คน` : "ไม่จำกัด"} />
            <InfoRow label="ผู้จัด" value={course.provider || "—"} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> รายละเอียด
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{course.description || "—"}</p>
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(course.createdAt)}</p>
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
