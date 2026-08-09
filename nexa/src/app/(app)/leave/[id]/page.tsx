import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock3, FileText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, fullName } from "@/lib/format";
import { getLeave } from "@/features/leave/service";
import { LEAVE_TYPE_LABEL, LeaveStatusBadge } from "@/features/leave/labels";

export const metadata: Metadata = { title: "รายละเอียดคำขอลา" };

export default async function LeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("leave:read");
  const { id } = await params;

  const request = await getLeave(session.companyId, session, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  const employeeName = fullName(request.employee.firstName, request.employee.lastName);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "การลา", href: "/leave" }, { label: employeeName }]}
        backHref="/leave"
        title={employeeName}
        description={`${request.employee.employeeCode} · ${LEAVE_TYPE_LABEL[request.type]}`}
        status={<LeaveStatusBadge status={request.status} />}
        actions={
          <Link href="/leave" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดคำขอลา</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={CalendarDays} label="ช่วงวันที่" value={`${formatDate(request.startDate)} - ${formatDate(request.endDate)}`} />
            <InfoRow icon={Clock3} label="วันลา" value={`${request.days} วัน`} />
            <InfoRow label="ประเภท" value={LEAVE_TYPE_LABEL[request.type]} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> เหตุผล
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{request.reason || "—"}</p>
          </div>
          {request.attachmentUrl && (
            <a
              href={request.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="size-4" /> ดูไฟล์แนบ (ใบรับรองแพทย์)
            </a>
          )}
          {request.decisionNote && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">คำสั่งการอนุมัติ</p>
              <p className="mt-2 text-sm text-muted-foreground">{request.decisionNote}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(request.createdAt)}</p>
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
