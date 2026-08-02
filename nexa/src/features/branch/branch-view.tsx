"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Building, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { type BranchRow } from "./schema";
import { useBranches, useDeleteBranch } from "./hooks";

export function BranchView() {
  const { can } = useAuth();
  const canManage = can("admin:update");
  const { data, isLoading, isError, refetch } = useBranches();

  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null);
  const deleteMut = useDeleteBranch();

  const branches = data?.data ?? [];

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบสาขาแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">สาขาทั้งหมด</h2>
        {canManage && (
          <Button render={<Link href="/branches/new" />}>
            <Plus className="size-4" /> เพิ่มสาขา
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : branches.length === 0 ? (
        <EmptyState icon={Building} title="ยังไม่มีสาขา" description="เพิ่มสาขาแรกขององค์กร" />
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <Card key={b.id} className="flex-row items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Building className="size-4 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {b.name} <span className="text-xs text-muted-foreground">({b.code})</span>
                  </p>
                  {b.address && <p className="truncate text-xs text-muted-foreground">{b.address}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="size-3" /> {b.employeeCount} คน</span>
                    {b.phone && <span>โทร. {b.phone}</span>}
                    {b.hasGeofence && (
                      <span className="inline-flex items-center gap-1 text-success"><MapPin className="size-3" /> geofence</span>
                    )}
                  </div>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" render={<Link href={`/branches/${b.id}/edit`} />}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="ลบ" className="text-destructive" onClick={() => setDeleteTarget(b)}>
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
        title="ลบสาขา"
        description={deleteTarget ? `ต้องการลบสาขา “${deleteTarget.name}” ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบสาขา"
        cancelLabel="ยกเลิก"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
