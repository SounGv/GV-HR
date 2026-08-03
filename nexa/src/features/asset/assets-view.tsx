"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2, UserPlus, Undo2, Boxes } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, formatCurrency } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { AssetAssignDialog } from "./asset-assign-dialog";
import { AssetStatusBadge, ASSET_STATUS_LABEL } from "./labels";
import { useAssets, useAssignAsset, useDeleteAsset } from "./hooks";
import { ASSET_STATUSES } from "./schema";
import type { Asset, AssetStatus } from "./types";

const ALL = "ALL";

export function AssetsView() {
  const { can } = useAuth();
  const canManage = can("asset:create");
  const canDelete = can("asset:delete");

  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, refetch } = useAssets(
    statusFilter === ALL ? undefined : (statusFilter as AssetStatus),
    search || undefined,
  );
  const assignMut = useAssignAsset();
  const deleteMut = useDeleteAsset();
  const assets = data?.data ?? [];

  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  async function returnAsset(a: Asset) {
    try {
      await assignMut.mutateAsync({ id: a.id, employeeId: null });
      toast.success("คืนทรัพย์สินเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบทรัพย์สินเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อ, รหัส, S/N…"
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="ทุกสถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
              {ASSET_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ASSET_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button render={<Link href="/assets/new" />}>
            <Plus className="size-4" /> เพิ่มทรัพย์สิน
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={6} />
      ) : assets.length === 0 ? (
        <EmptyState icon={Boxes} title="ยังไม่มีทรัพย์สิน" description={canManage ? "เริ่มต้นด้วยการเพิ่มทรัพย์สิน" : "ยังไม่มีข้อมูล"} />
      ) : (
        <Card className="gap-0 overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>รหัส</TableHead>
                <TableHead>ทรัพย์สิน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ผู้ถือครอง</TableHead>
                <TableHead>ราคา</TableHead>
                {canManage && <TableHead className="text-right">จัดการ</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.assetCode}</TableCell>
                  <TableCell>
                    <Link href={`/assets/${a.id}`} className="block">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.category}
                        {a.serialNumber ? ` · ${a.serialNumber}` : ""}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AssetStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.assignedTo ? fullName(a.assignedTo.firstName, a.assignedTo.lastName) : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.purchasePrice != null ? formatCurrency(a.purchasePrice) : "-"}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {a.status === "ASSIGNED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={assignMut.isPending}
                            onClick={() => returnAsset(a)}
                          >
                            <Undo2 className="size-4" /> คืน
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setAssignTarget(a)}>
                            <UserPlus className="size-4" /> เบิก
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="แก้ไข"
                          render={<Link href={`/assets/${a.id}/edit`} />}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบ"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AssetAssignDialog asset={assignTarget} onClose={() => setAssignTarget(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบทรัพย์สิน"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" (${deleteTarget.assetCode}) ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
