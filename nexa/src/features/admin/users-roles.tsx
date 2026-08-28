"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiError } from "@/lib/api/client";
import { fullName, loginIdentifier } from "@/lib/format";
import { useDeleteUser, useUsers } from "./hooks";
import type { AdminUser, AiAccessScope } from "./types";

const AI_SCOPE_LABEL: Record<AiAccessScope, string> = {
  TEAM: "AI: ทีม",
  DEPARTMENT: "AI: แผนก",
  COMPANY: "AI: องค์กร",
};

export function UsersRoles() {
  const { data, isLoading, isError, refetch } = useUsers();
  const users = data?.data ?? [];
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const deleteMut = useDeleteUser();

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบบัญชีผู้ใช้เรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={5} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>ผู้ใช้</TableHead>
            <TableHead>บทบาท</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="font-medium">
                  {u.employee ? fullName(u.employee.firstName, u.employee.lastName) : loginIdentifier(u)}
                </div>
                <div className="text-xs text-muted-foreground">{u.email ?? `@${u.username}`}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.roleNames.length > 0 ? (
                    u.roleNames.map((n) => (
                      <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {n}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">— ไม่มีบทบาท —</span>
                  )}
                  {u.aiAccessScope && (
                    <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs text-info">
                      {AI_SCOPE_LABEL[u.aiAccessScope]}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button variant="outline" size="sm" render={<Link href={`/admin/users/${u.id}/roles`} />}>
                    แก้ไขบทบาท
                  </Button>
                  <Button variant="outline" size="sm" render={<Link href={`/admin/users/${u.id}/ai-access`} />}>
                    AI Assistant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(u)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบบัญชีผู้ใช้"
        description={
          deleteTarget
            ? `ต้องการลบบัญชี "${deleteTarget.employee ? fullName(deleteTarget.employee.firstName, deleteTarget.employee.lastName) : loginIdentifier(deleteTarget)}" ใช่หรือไม่? ใช้สำหรับล้างบัญชีที่ไม่ได้ใช้แล้ว (เช่น บัญชีทดสอบ) — ถ้าบัญชีนี้ยังผูกกับพนักงานที่ทำงานอยู่ ระบบจะปฏิเสธและให้ไปลบพนักงานคนนั้นก่อน`
            : undefined
        }
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
