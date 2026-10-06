import type { Metadata } from "next";
import Link from "next/link";

import { requirePageAnyPermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceStatusTabs } from "@/features/attendance-status/attendance-status-tabs";
import { DepartmentFilter } from "@/features/attendance-status/department-filter";
import { listDepartmentOptions, loadAttendanceWatch } from "@/features/attendance-status/service";
import { watchListHref } from "@/features/attendance-status/status-meta";
import {
  WATCH_ABSENT_DAYS,
  WATCH_LATE_COUNT,
  WATCH_LEAVE_COUNT,
} from "@/features/attendance-status/status-rules";
import { WatchPeopleList } from "@/features/attendance-status/watch-people-list";

export const metadata: Metadata = { title: "ควรติดตามการเข้างาน" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Tab = "all" | "late" | "absent" | "leave";
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "all", label: "ทั้งหมด", empty: "ยังไม่มีใครเข้าเกณฑ์ติดตาม" },
  { key: "late", label: "สายบ่อย", empty: "ยังไม่มีใครสายบ่อย" },
  { key: "absent", label: "ขาดบ่อย", empty: "ยังไม่มีใครขาดบ่อย" },
  { key: "leave", label: "ลาบ่อย", empty: "ยังไม่มีใครลาบ่อย" },
];

/**
 * People who reached a late / absent / leave threshold in the last 30 days.
 * For talking with each person, not for judging by numbers; sick leave is never
 * counted. Visible only to people who can approve or manage attendance and
 * narrowed to their own team unless they are company-wide.
 */
export default async function AttendanceWatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; dept?: string }>;
}) {
  const session = await requirePageAnyPermission(["attendance:approve", "attendance:manage"]);
  const { tab: tabParam, dept } = await searchParams;
  const deptIds = dept && UUID_RE.test(dept) ? [dept] : [];
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "all";

  let watch;
  let departments;
  try {
    watch = await loadAttendanceWatch(session.companyId, session, deptIds);
    departments = await listDepartmentOptions(session.companyId);
  } catch {
    return (
      <div className="theme-flip7 space-y-4">
        <PageHeaderBar title="ควรติดตาม" backHref="/dashboard/attendance" />
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-base font-semibold">โหลดรายชื่อที่ควรติดตามไม่สำเร็จ</p>
            <Link
              href={watchListHref(tab, deptIds)}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              ลองอีกครั้ง
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const countOf = (t: Tab) => (t === "all" ? watch.people.length : watch.people.filter((p) => p.reasons.includes(t)).length);
  const people = tab === "all" ? watch.people : watch.people.filter((p) => p.reasons.includes(tab));
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="theme-flip7 space-y-4">
      <PageHeaderBar
        breadcrumbs={[
          { label: "ภาพรวม", href: "/dashboard" },
          { label: "การเข้างานวันนี้", href: "/dashboard/attendance" },
          { label: "ควรติดตาม" },
        ]}
        backHref="/dashboard/attendance"
        title={`ควรติดตาม (${watch.windowDays} วันล่าสุด)`}
        sticky={false}
      />

      <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
        ใช้สำหรับพูดคุยกับพนักงานเป็นรายคน ไม่ใช่ตัดสินจากตัวเลข เข้าเกณฑ์เมื่อสาย ≥ {WATCH_LATE_COUNT} ครั้ง, ขาด ≥{" "}
        {WATCH_ABSENT_DAYS} วัน หรือลากิจ/ไม่รับค่าจ้าง ≥ {WATCH_LEAVE_COUNT} ครั้ง (ไม่นับลาป่วยและลาตามสิทธิ์) คนที่หยุดเช็คอินในแอป
        อาจถูกนับเป็นขาด ควรสอบถามก่อนสรุป
      </p>

      <DepartmentFilter departments={departments} selected={deptIds[0] ?? null} />
      <AttendanceStatusTabs
        label="กรองตามเกณฑ์"
        tabs={TABS.map((t) => ({ href: watchListHref(t.key, deptIds), label: t.label, count: countOf(t.key), active: t.key === tab }))}
      />
      {watch.truncatedFrom && (
        <p className="text-sm text-status-late-fg">ข้อมูลมากเกินกว่าจะนับครบ จึงนับตั้งแต่ {watch.truncatedFrom} เป็นต้นไป</p>
      )}
      <WatchPeopleList key={`${tab}-${deptIds[0] ?? ""}`} people={people} empty={current.empty} />
    </div>
  );
}
