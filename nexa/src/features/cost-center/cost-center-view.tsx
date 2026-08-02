"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Wallet, Users } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { type CostCenterRow } from "./schema";
import { useCostCenters, useDeleteCostCenter } from "./hooks";

export function CostCenterView() {
  const { can } = useAuth();
  const canManage = can("admin:update");
  const { data, isLoading, isError, refetch } = useCostCenters();

  const [deleteTarget, setDeleteTarget] = useState<CostCenterRow | null>(null);
  const deleteMut = useDeleteCostCenter();

  const items = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบศูนย์ต้นทุนแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ศูนย์ต้นทุนทั้งหมด</h2>
        {canManage && (
          <Button render={<Link href="/cost-centers/new" />}>
            <Plus className="size-4" /> เพิ่มศูนย์ต้นทุน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={Wallet} title="ยังไม่มีศูนย์ต้นทุน" description="เพิ่มศูนย์ต้นทุนเพื่อจัดกลุ่มงบประมาณของพนักงาน" />
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <Card key={c.id} className="flex-row items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Wallet className="size-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {c.name} <span className="text-xs text-muted-foreground">({c.code})</span>
                  </p>
                  {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="size-3" /> {c.employeeCount} คน
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" render={<Link href={`/cost-centers/${c.id}/edit`} />}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="ลบ" className="text-destructive" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบศูนย์ต้นทุน"
        description={deleteTarget ? `ต้องการลบ “${deleteTarget.name}” ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        cancelLabel="ยกเลิก"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
