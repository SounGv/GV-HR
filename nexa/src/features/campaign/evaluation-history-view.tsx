"use client";

import Link from "next/link";
import { History } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { formatDate } from "@/lib/format";
import { useEmployeeEvaluationHistory } from "./hooks";
import type { CampaignStatus } from "./types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "ฉบับร่าง",
  ACTIVE: "กำลังดำเนินการ",
  CLOSED: "ปิดแล้ว",
  ARCHIVED: "จัดเก็บถาวร",
};

export function EvaluationHistoryView({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, refetch } = useEmployeeEvaluationHistory(employeeId);
  const rows = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  if (rows.length === 0) {
    return (
      <EmptyState icon={History} title="ยังไม่มีประวัติการประเมิน" description="ผลการประเมินจากทุกแคมเปญจะแสดงที่นี่" />
    );
  }

  return (
    <Card className="divide-y divide-border p-0">
      {rows.map((r) => (
        <Link
          key={r.participantId}
          href={`/performance/campaigns/${r.campaign.id}/participants/${r.participantId}`}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
        >
          <div className="min-w-0">
            <div className="font-medium text-foreground">{r.campaign.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {r.campaign.cycle} · {formatDate(r.campaign.startDate)} - {formatDate(r.campaign.endDate)} ·{" "}
              {STATUS_LABEL[r.campaign.status]}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {r.overallScore != null ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">{r.overallScore.toFixed(1)}</div>
                <div className="text-[10px] text-muted-foreground">{r.band}</div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">ยังไม่มีคะแนน</span>
            )}
            {r.finalizedAt && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                สรุปผลแล้ว
              </span>
            )}
          </div>
        </Link>
      ))}
    </Card>
  );
}
