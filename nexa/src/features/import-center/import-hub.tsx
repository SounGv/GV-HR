"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { ImportCenter as EmployeeImportView } from "@/features/employee-import/import-center";
import { PayrollImportView } from "@/features/payroll-import/import-view";
import { AttendanceImportView } from "@/features/attendance-import/import-view";
import { KpiImportView } from "@/features/kpi-import/import-view";
import { PerformanceImportView } from "@/features/performance-import/import-view";

const TABS = [
  { key: "employee", label: "พนักงาน", permission: "employee:create", View: EmployeeImportView },
  { key: "payroll", label: "เงินเดือน", permission: "payroll:update", View: PayrollImportView },
  { key: "attendance", label: "เวลาเข้า-ออกงาน", permission: "attendance:update", View: AttendanceImportView },
  { key: "kpi", label: "KPI", permission: "kpi:create", View: KpiImportView },
  { key: "performance", label: "ผลประเมิน", permission: "performance:approve", View: PerformanceImportView },
] as const;

/** Import Center — one hub, one tab per data domain, each with its own upload → preview → summary flow. */
export function ImportHub() {
  const { can } = useAuth();
  const visible = TABS.filter((t) => can(t.permission));

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">คุณไม่มีสิทธิ์นำเข้าข้อมูลในหมวดใดเลย</p>;
  }

  return (
    <Tabs defaultValue={visible[0].key} className="space-y-4">
      <TabsList>
        {visible.map((t) => (
          <TabsTrigger key={t.key} value={t.key}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {visible.map((t) => (
        <TabsContent key={t.key} value={t.key}>
          <t.View />
        </TabsContent>
      ))}
    </Tabs>
  );
}
