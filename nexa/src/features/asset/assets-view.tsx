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
import { useIsMobile } from "@/hooks/use-mobile";

import { AssetAssignDialog } from "./asset-assign-dialog";
import { AssetStatusBadge, ASSET_STATUS_LABEL } from "./labels";
import { useAssets, useAssignAsset, useDeleteAsset } from "./hooks";
import { ASSET_STATUSES } from "./schema";
import type { Asset, AssetStatus } from "./types";

const ALL = "ALL";

export function AssetsView() {
  const { can } = useAuth();
  // Render only the layout that fits the screen.
  const isMobile = useIsMobile();
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
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ค้นหาชื่อ, รหัส, S/N…"
              className="pl-8 max-sm:h-11"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger className="min-w-[160px] w-auto max-w-[320px] max-sm:h-11 max-sm:w-full" aria-label="สถานะ">
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
          <Button render={<Link href="/assets/new" />} className="max-sm:h-11">
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
      ) : isMobile ? (
        <ul className="space-y-3">
          {assets.map((a) => (
            <li key={a.id} className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
              <Link href={`/assets/${a.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold break-words text-foreground">{a.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.assetCode} · {a.category}
                      {a.serialNumber ? ` · ${a.serialNumber}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AssetStatusBadge status={a.status} />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">ผู้ถือครอง</dt>
                    <dd className="font-medium">
                      {a.assignedTo ? fullName(a.assignedTo.firstName, a.assignedTo.lastName) : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">ราคา</dt>
                    <dd className="font-medium tabular-nums">
                      {a.purchasePrice != null ? formatCurrency(a.purchasePrice) : "-"}
                    </dd>
                  </div>
                </dl>
              </Link>
              {canManage && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  {a.status === "ASSIGNED" ? (
                    <Button variant="outline" className="h-11 flex-1" disabled={assignMut.isPending} onClick={() => returnAsset(a)}>
                      <Undo2 className="size-4" /> คืน
                    </Button>
                  ) : (
                    <Button variant="outline" className="h-11 flex-1" onClick={() => setAssignTarget(a)}>
                      <UserPlus className="size-4" /> เบิก
                    </Button>
                  )}
                  <Button variant="outline" className="h-11 flex-1" render={<Link href={`/assets/${a.id}/edit`} />}>
                    <Pencil className="size-4" /> แก้ไข
                  </Button>
                  {canDelete && (
                    <Button variant="outline" size="icon" className="size-11" aria-label="ลบ" onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
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
