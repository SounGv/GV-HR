"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/auth-context";
import { useScheduleTemplates, useDeleteScheduleTemplate } from "./hooks";
import type { ScheduleTemplateListItem } from "./types";

const INTERVAL_LABEL: Record<number, string> = {
  1: "ทุกเดือน",
  3: "ทุกไตรมาส",
  6: "ทุกครึ่งปี",
  12: "ทุกปี",
};

export function ScheduleTemplateListView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const { data, isLoading, isError, refetch } = useScheduleTemplates();
  const deleteMutation = useDeleteScheduleTemplate();
  const [deleteTarget, setDeleteTarget] = useState<ScheduleTemplateListItem | null>(null);
  const templates = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบรอบอัตโนมัติเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมินผล", href: "/performance" }, { label: "รอบอัตโนมัติ" }]}
        backHref="/performance"
        title="รอบประเมินอัตโนมัติ"
        description="ระบบจะสร้างแคมเปญประเมินผลใหม่ให้อัตโนมัติตามรอบที่กำหนด (เริ่มต้นเป็นฉบับร่างเสมอ)"
        actions={
          canManage ? (
            <Button render={<Link href="/performance/campaigns/schedules/new" />}>
              <Plus className="size-4" /> สร้างรอบอัตโนมัติ
            </Button>
          ) : undefined
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="ยังไม่มีรอบประเมินอัตโนมัติ"
          description={canManage ? "สร้างรอบแรก เช่น ประเมินรายเดือนของแผนกใดแผนกหนึ่ง" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">{t.name}</span>
                    {!t.active && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        หยุดชั่วคราว
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.department.name} · {INTERVAL_LABEL[t.intervalMonths] ?? `ทุก ${t.intervalMonths} เดือน`}
                  </p>
                </div>
                {(canManage || canDelete) && (
                  <div className="flex shrink-0 items-center gap-1">
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="แก้ไข"
                        render={<Link href={`/performance/campaigns/schedules/${t.id}/edit`} />}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ลบ"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">รอบถัดไป: {formatDate(t.nextRunAt)}</p>
              {t.lastGeneratedCampaign && (
                <Link
                  href={`/performance/campaigns/${t.lastGeneratedCampaign.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  แคมเปญล่าสุดที่สร้าง: {t.lastGeneratedCampaign.name}
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบรอบอัตโนมัติ"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่? แคมเปญที่เคยสร้างไว้จะไม่ถูกลบ` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
