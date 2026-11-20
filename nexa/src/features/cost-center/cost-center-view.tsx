"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">ลำดับ</TableHead>
              <TableHead>รหัส</TableHead>
              <TableHead className="w-full">ชื่อศูนย์ต้นทุน</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead className="text-center">พนักงาน</TableHead>
              {canManage && <TableHead className="text-center">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c, i) => (
              <TableRow key={c.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="tabular-nums">{c.code}</TableCell>
                <TableCell className="whitespace-normal">
                  {canManage ? (
                    <Link href={`/cost-centers/${c.id}/edit`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  ) : (
                    <span className="font-medium break-words text-foreground">{c.name}</span>
                  )}
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground" title={c.description ?? undefined}>{c.description || "-"}</TableCell>
                <TableCell className="text-center tabular-nums">{c.employeeCount} คน</TableCell>
                {canManage && (
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${c.name}`} render={<Link href={`/cost-centers/${c.id}/edit`} />}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`ลบ ${c.name}`} onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
