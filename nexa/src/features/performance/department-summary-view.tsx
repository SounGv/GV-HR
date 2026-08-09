"use client";

import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { ReportSummaryChart } from "@/features/report/report-summary-chart";
import { bandTone } from "./calc";
import { useDepartmentSummary } from "./hooks";

const TONE_CLASS: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export function DepartmentSummaryView() {
  const { data, isLoading, isError, refetch } = useDepartmentSummary();
  const rows = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (rows.length === 0) {
    return <EmptyState icon={Building2} title="ยังไม่มีข้อมูล" description="สรุปผลระดับแผนกจะแสดงเมื่อมีการประเมินพนักงาน" />;
  }

  const chartData = rows.filter((r) => r.reviewedCount > 0).map((r) => ({ label: r.department, value: r.averageScore }));

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">สรุปผลประเมินระดับแผนก</h2>
      {chartData.length > 0 && (
        <ReportSummaryChart data={chartData} label="คะแนนเฉลี่ยตามแผนก (เต็ม 5)" unit="คะแนน" />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.department} className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">{r.department}</p>
              <span className="text-xs text-muted-foreground">
                ประเมินแล้ว {r.reviewedCount}/{r.employeeCount} คน
              </span>
            </div>

            {r.reviewedCount > 0 ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {r.averageScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 5.0 เฉลี่ย</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(r.bandCounts).map(([band, count]) => (
                    <span
                      key={band}
                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE_CLASS[bandTone(band)])}
                    >
                      {band} · {count}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่มีพนักงานในแผนกนี้ที่ถูกประเมิน</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
