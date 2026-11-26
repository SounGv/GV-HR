import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/shared/page-header";
import { CorrectionView } from "@/features/attendance-correction/correction-view";
import { LATE_FIRST_SCAN_MIN, loadMissedScans, type MissedScans } from "@/features/dashboard-daily/service";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "แก้ไขเวลาเข้า-ออกงาน" };

export default async function AttendanceCorrectionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requirePagePermission("attendance:read");
  const { tab } = await searchParams;
  // The scans that look forgotten (same list as the home board's card, narrowed to the team for a manager); only approvers see the tab.
  let missed: MissedScans | null = null;
  if (can(session.perms, "attendance:approve") || can(session.perms, "attendance:manage")) {
    try {
      missed = await loadMissedScans(session.companyId, session);
    } catch {
      missed = null;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="แก้ไขเวลาเข้า-ออกงาน" description="ส่งคำขอแก้ไขเวลาเข้า-ออกงาน และอนุมัติคำขอของทีม" />
      <CorrectionView tab={tab} missed={missed} lateHours={LATE_FIRST_SCAN_MIN / 60} />
    </div>
  );
}
