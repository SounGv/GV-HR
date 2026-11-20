"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Building, QrCode } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">ลำดับ</TableHead>
              <TableHead>รหัส</TableHead>
              <TableHead className="w-full">ชื่อสาขา</TableHead>
              <TableHead>ที่อยู่</TableHead>
              <TableHead>โทรศัพท์</TableHead>
              <TableHead className="text-center">พนักงาน</TableHead>
              <TableHead className="text-center">จำกัดพื้นที่</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b, i) => (
              <TableRow key={b.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="tabular-nums">{b.code}</TableCell>
                <TableCell className="whitespace-normal">
                  {canManage ? (
                    <Link href={`/branches/${b.id}/edit`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                      {b.name}
                    </Link>
                  ) : (
                    <span className="font-medium break-words text-foreground">{b.name}</span>
                  )}
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground" title={b.address ?? undefined}>{b.address || "-"}</TableCell>
                <TableCell className="tabular-nums">{b.phone || "-"}</TableCell>
                <TableCell className="text-center tabular-nums">{b.employeeCount} คน</TableCell>
                <TableCell className="text-center">
                  {b.hasGeofence ? <StatusChip tone="success" label="ตั้งแล้ว" /> : <StatusChip tone="neutral" label="ยังไม่ตั้ง" />}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="size-9" aria-label={`ดู QR ลงเวลาเข้างาน ${b.name}`} render={<Link href={`/branches/${b.id}/qr`} />}>
                      <QrCode className="size-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" className="size-9" aria-label={`แก้ไข ${b.name}`} render={<Link href={`/branches/${b.id}/edit`} />}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`ลบ ${b.name}`} onClick={() => setDeleteTarget(b)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
