"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { ClockCard } from "@/features/attendance/clock-card";
import { AttendanceHistory } from "@/features/attendance/attendance-history";
import { RequestFormPage } from "@/features/workflow/request-form-page";
import { ShiftView } from "@/features/shift/shift-view";
import { KpiView } from "@/features/kpi/kpi-view";
import { PerformanceView } from "@/features/performance/performance-view";
import { PayrollView } from "@/features/payroll/payroll-view";
import { ExpenseFormPage } from "@/features/expense/expense-form-page";
import { EmployeeTable } from "@/features/employee/employee-table";
import { EmployeeFormPage } from "@/features/employee/employee-form-page";
import { OrgChart } from "@/features/organization/org-chart";
import { useDepartments } from "@/features/organization/hooks";
import type { DepartmentNode, DepartmentRow } from "@/features/organization/types";
import { AdminView } from "@/features/admin/admin-view";
import { WorkflowView } from "@/features/workflow/workflow-view";
import { GeofenceSettings } from "@/features/geofence/geofence-settings";
import { LeaveView } from "@/features/leave/leave-view";
import { ReportView } from "@/features/report/report-view";
import { CompanyProfileForm } from "@/features/company/company-profile-form";
import { MOBILE_ALL_ITEMS, getMobileMenuVisibility, setMobileMenuItemVisible } from "@/config/mobile-menu";
import { MobileScreen } from "../mobile-screen";
import { MobileListGroup, MobileListRow } from "../mobile-list-group";
import { Switch } from "@/components/ui/switch";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { useState } from "react";

function buildTree(rows: DepartmentRow[]): DepartmentNode[] {
  const nodes = new Map<string, DepartmentNode>();
  rows.forEach((r) => nodes.set(r.id, { ...r, children: [] }));
  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function MobileComingSoonCard({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">ฟีเจอร์นี้กำลังพัฒนา — เร็วๆ นี้</p>
    </div>
  );
}

function ModuleShell({
  title,
  backHref = "/dashboard",
  children,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <MobileScreen title={title} backHref={backHref} contentClassName="space-y-4 pb-6">
      {children}
    </MobileScreen>
  );
}

export function MobileAttendanceModule() {
  return (
    <ModuleShell title="เช็คอิน">
      <ClockCard />
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการลงเวลา</h2>
        <AttendanceHistory />
      </div>
    </ModuleShell>
  );
}

export function MobileTimeEditModule() {
  return (
    <ModuleShell title="แก้ไขเวลา">
      <RequestFormPage />
    </ModuleShell>
  );
}

export function MobileShiftModule() {
  return (
    <ModuleShell title="กะการทำงาน">
      <ShiftView />
    </ModuleShell>
  );
}

export function MobileKpiModule() {
  return (
    <ModuleShell title="KPI & Level">
      <KpiView />
    </ModuleShell>
  );
}

export function MobileReviewModule() {
  return (
    <ModuleShell title="ประเมินผลงาน">
      <PerformanceView />
    </ModuleShell>
  );
}

export function MobilePayslipModule() {
  return (
    <ModuleShell title="สลิปเงินเดือน">
      <PayrollView />
    </ModuleShell>
  );
}

export function MobileExpenseModule() {
  return (
    <ModuleShell title="เบิกจ่าย" backHref="/dashboard">
      <ExpenseFormPage />
    </ModuleShell>
  );
}

export function MobileEmpListModule() {
  return (
    <ModuleShell title="พนักงาน">
      <EmployeeTable />
    </ModuleShell>
  );
}

export function MobileAddEmpModule() {
  return (
    <ModuleShell title="เพิ่มพนักงาน" backHref="/services?view=employees">
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        สำหรับการแก้ไขแบบเต็มหน้าจอ ใช้{" "}
        <Link href="/employees/new" className="font-medium text-primary underline">
          หน้าเพิ่มพนักงานบนเดสก์ท็อป
        </Link>
      </p>
      <EmployeeFormPage mode="new" />
    </ModuleShell>
  );
}

function OrgChartLoader() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDepartments();
  const tree = useMemo(() => buildTree(data?.data ?? []), [data?.data]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;

  return <OrgChart tree={tree} companyName={user.company?.name} />;
}

export function MobileOrgChartModule() {
  return (
    <ModuleShell title="แผนผังองค์กร">
      <OrgChartLoader />
    </ModuleShell>
  );
}

export function MobileAccessModule() {
  return (
    <ModuleShell title="ผู้ดูแลระบบ">
      <AdminView />
    </ModuleShell>
  );
}

export function MobileApprovalsModule() {
  return (
    <ModuleShell title="คำขออนุมัติ">
      <WorkflowView />
    </ModuleShell>
  );
}

export function MobileOnsiteModule() {
  return (
    <ModuleShell title="พื้นที่เช็คอิน">
      <GeofenceSettings />
    </ModuleShell>
  );
}

export function MobileLeaveAllModule() {
  return (
    <ModuleShell title="การลา">
      <LeaveView />
    </ModuleShell>
  );
}

export function MobilePayrollRunModule() {
  return (
    <ModuleShell title="จัดการเงินเดือน">
      <PayrollView />
    </ModuleShell>
  );
}

export function MobileKpiOrgModule() {
  return (
    <ModuleShell title="KPI องค์กร">
      <KpiView />
    </ModuleShell>
  );
}

export function MobileExportModule() {
  return (
    <ModuleShell title="รายงานและส่งออก">
      <ReportView />
    </ModuleShell>
  );
}

export function MobileOrgSettingsModule() {
  return (
    <ModuleShell title="ข้อมูลบริษัท">
      <CompanyProfileForm />
    </ModuleShell>
  );
}

export function MobileGoalsModule() {
  return (
    <ModuleShell title="เป้าหมาย">
      <MobileComingSoonCard title="เป้าหมาย" />
    </ModuleShell>
  );
}

export function MobileFeedbackModule() {
  return (
    <ModuleShell title="Feedback 360">
      <MobileComingSoonCard title="Feedback 360" />
    </ModuleShell>
  );
}

export function MobileBenefitModule() {
  return (
    <ModuleShell title="สวัสดิการ">
      <MobileComingSoonCard title="สวัสดิการ" />
    </ModuleShell>
  );
}

export function MobileMenuSettingsModule() {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getMobileMenuVisibility());

  function toggle(id: string, checked: boolean) {
    setMobileMenuItemVisible(id, checked);
    setVisibility((prev) => ({ ...prev, [id]: checked }));
  }

  return (
    <ModuleShell title="ตั้งค่าเมนู">
      <p className="text-sm text-muted-foreground">เลือกเมนูที่จะแสดงในหน้าหลักมือถือ (บันทึกในเครื่อง)</p>
      <MobileListGroup title="เมนูทั้งหมด">
        {MOBILE_ALL_ITEMS.map((item) => {
          const visible = visibility[item.id] !== false;
          return (
            <MobileListRow
              key={item.id}
              label={item.label}
              trailing={
                <Switch
                  checked={visible}
                  onCheckedChange={(checked) => toggle(item.id, checked)}
                  aria-label={`แสดง ${item.label}`}
                />
              }
            />
          );
        })}
      </MobileListGroup>
    </ModuleShell>
  );
}
