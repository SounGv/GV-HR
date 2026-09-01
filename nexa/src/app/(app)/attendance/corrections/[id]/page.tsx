import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, FileText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, fullName } from "@/lib/format";
import { getAttendanceCorrection } from "@/features/attendance-correction/service";
import { AttendanceCorrectionDecideActions } from "@/features/attendance-correction/decide-actions";
import { LeaveStatusBadge } from "@/features/leave/labels";

export const metadata: Metadata = { title: "รายละเอียดคำขอแก้ไขเวลา" };

function fmtTime(value: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(value),
  );
}

export default async function AttendanceCorrectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("attendance:read");
  const { id } = await params;

  const request = await getAttendanceCorrection(session.companyId, session, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  const employeeName = fullName(request.employee.firstName, request.employee.lastName);

  // Mirrors decideAttendanceCorrection's own authorization exactly (isManager
  // || HR-level, never your own request) — this just decides whether to
  // show the buttons; the service still re-checks everything server-side.
  const isManager = request.employee.managerId === session.employeeId;
  const isHrLevel = session.perms.includes("*") || session.perms.includes("attendance:approve");
  const isOwnRequest = request.employee.id === session.employeeId;
  const canDecide = request.status === "PENDING" && !isOwnRequest && (isManager || isHrLevel);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "แก้ไขเวลาเข้า-ออกงาน", href: "/attendance/corrections" }, { label: employeeName }]}
        backHref="/attendance/corrections"
        title={employeeName}
        description={`${request.employee.employeeCode} · ${formatDate(request.workDate)}`}
        status={<LeaveStatusBadge status={request.status} />}
        actions={
          <div className="flex items-center gap-3">
            <AttendanceCorrectionDecideActions id={request.id} show={canDecide} />
            <Link href="/attendance/corrections" className="text-sm text-muted-foreground hover:text-foreground">
              กลับรายการ
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดคำขอแก้ไขเวลา</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={Clock3} label="วันที่" value={formatDate(request.workDate)} />
            <InfoRow label="เวลาเข้าที่ขอแก้" value={fmtTime(request.requestedClockIn)} />
            <InfoRow label="เวลาออกที่ขอแก้" value={fmtTime(request.requestedClockOut)} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> เหตุผล
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{request.reason || "—"}</p>
          </div>
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
