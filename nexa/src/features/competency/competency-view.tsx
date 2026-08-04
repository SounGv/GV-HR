"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";

import { useCompetencies, useDeleteCompetency } from "./hooks";
import type { Competency } from "./types";

export function CompetencyView() {
  const { can } = useAuth();
  const canManage = can("campaign:create");
  const canDelete = can("campaign:delete");

  const { data, isLoading, isError, refetch } = useCompetencies(true);
  const deleteMutation = useDeleteCompetency();
  const [deleteTarget, setDeleteTarget] = useState<Competency | null>(null);
  const competencies = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบสมรรถนะเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          สมรรถนะในคลังนี้ใช้ประกอบสร้างแคมเปญประเมินผล
        </p>
        {canManage && (
          <Button render={<Link href="/performance/competencies/new" />}>
            <Plus className="size-4" /> เพิ่มสมรรถนะ
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : competencies.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="ยังไม่มีสมรรถนะในคลัง"
          description={canManage ? "เพิ่มสมรรถนะแรก หรือให้ AI ออกแบบให้ตอนสร้างแคมเปญ" : "ยังไม่มีข้อมูล"}
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {competencies.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{c.name}</span>
                  {!c.active && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      ปิดใช้งาน
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.description}</p>
                )}
              </div>
              {(canManage || canDelete) && (
                <div className="flex shrink-0 items-center gap-1">
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="แก้ไข"
                      render={<Link href={`/performance/competencies/${c.id}/edit`} />}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="ลบ"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบสมรรถนะ"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
