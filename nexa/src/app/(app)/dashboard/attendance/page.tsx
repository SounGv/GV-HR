import type { Metadata } from "next";
import Link from "next/link";

import { requirePageAnyPermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceList } from "@/features/attendance-status/attendance-list";
import { AttendanceStatusTabs } from "@/features/attendance-status/attendance-status-tabs";
import { DepartmentFilter } from "@/features/attendance-status/department-filter";
import { listDepartmentOptions, loadTodayAttendance } from "@/features/attendance-status/service";
import { STATUS_META, attendanceListHref } from "@/features/attendance-status/status-meta";
import type { TodayStatus } from "@/features/attendance-status/status-rules";

export const metadata: Metadata = { title: "การเข้างานวันนี้" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARAM_TO_STATUS: Record<string, TodayStatus> = {
  normal: "NORMAL",
  late: "LATE",
  absent: "ABSENT",
  leave: "ON_LEAVE",
  notyet: "NOT_YET",
};
const TAB_ORDER: TodayStatus[] = ["NORMAL", "LATE", "ABSENT", "ON_LEAVE", "NOT_YET"];

/**
 * Today's people by status. Visible only to people who can approve or manage
 * attendance; the data layer narrows it to their own team unless they are
 * company-wide. No photos or coordinates are read.
 */
export default async function AttendanceTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; dept?: string }>;
}) {
  const session = await requirePageAnyPermission(["attendance:approve", "attendance:manage"]);
  const { status: statusParam, dept } = await searchParams;
  const deptIds = dept && UUID_RE.test(dept) ? [dept] : [];
  const status = statusParam ? PARAM_TO_STATUS[statusParam] : undefined;

  let data;
  let departments;
  try {
    data = await loadTodayAttendance(session.companyId, session, deptIds);
    departments = await listDepartmentOptions(session.companyId);
  } catch {
    return (
      <div className="theme-flip7 space-y-4">
        <PageHeaderBar title="การเข้างานวันนี้" backHref="/dashboard" />
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-base font-semibold">โหลดข้อมูลการเข้างานไม่สำเร็จ</p>
            <p className="text-sm text-muted-foreground">ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง</p>
            <Link
              href={attendanceListHref(status ?? "all", deptIds)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              ลองอีกครั้ง
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const people = status ? data.people.filter((p) => p.status === status) : data.people;
  const tabs = [
    { href: attendanceListHref("all", deptIds), label: "ทั้งหมด", count: data.total, active: !status },
    ...TAB_ORDER.map((s) => ({
      href: attendanceListHref(s, deptIds),
      label: STATUS_META[s].label,
      count: data.counts[s],
      active: status === s,
    })),
  ];

  return (
    <div className="theme-flip7 space-y-4">
      <PageHeaderBar
        breadcrumbs={[{ label: "ภาพรวม", href: "/dashboard" }, { label: "การเข้างานวันนี้" }]}
        backHref="/dashboard"
        title="การเข้างานวันนี้"
        description={`ข้อมูล ณ ${data.asOf} น.`}
        sticky={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DepartmentFilter departments={departments} selected={deptIds[0] ?? null} />
        <p className="text-sm text-muted-foreground">ข้อมูล ณ {data.asOf} น.</p>
      </div>

      {!data.isWorkingDay ? (
        <Card>
          <CardContent className="py-6 text-base">
            วันนี้ไม่ใช่วันทำงาน ({data.nonWorkingReason}) จึงไม่นับสาย ขาด หรือลา
          </CardContent>
        </Card>
      ) : (
        <>
          <AttendanceStatusTabs tabs={tabs} label="กรองตามสถานะ" />
          <AttendanceList key={`${status ?? "all"}-${deptIds[0] ?? ""}`} people={people} status={status ?? "all"} />
        </>
      )}

      {data.notChecked > 0 && (
        <p className="text-sm text-muted-foreground">
          ไม่นับ {data.notChecked} คนที่ยังไม่เคยใช้เช็คอินในแอป (ไม่ถือว่าขาดงาน)
        </p>
      )}
    </div>
  );
}
