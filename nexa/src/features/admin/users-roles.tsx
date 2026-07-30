"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { fullName } from "@/lib/format";
import { useRoles, useUsers, useSetUserRoles } from "./hooks";
import type { AdminUser } from "./types";

export function UsersRoles() {
  const { data, isLoading, isError, refetch } = useUsers();
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const users = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={5} />;

  return (
    <>
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
                    {u.employee ? fullName(u.employee.firstName, u.employee.lastName) : u.email}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
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
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                    แก้ไขบทบาท
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditRolesDialog user={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function EditRolesDialog({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { data: rolesData } = useRoles();
  const setMut = useSetUserRoles();
  const roles = rolesData?.data ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) setSelected(new Set(user.roleIds));
  }, [user]);

  async function save() {
    if (!user) return;
    try {
      await setMut.mutateAsync({ id: user.id, roleIds: [...selected] });
      toast.success("อัปเดตบทบาทเรียบร้อย");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            บทบาทของ {user?.employee ? fullName(user.employee.firstName, user.employee.lastName) : user?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
              <Checkbox
                checked={selected.has(r.id)}
                onCheckedChange={(c) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (c === true) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  })
                }
              />
              <span className="flex-1">
                <span className="font-medium">{r.name}</span>
                {r.description && <span className="ml-1 text-xs text-muted-foreground">· {r.description}</span>}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setMut.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={save} disabled={setMut.isPending}>
            {setMut.isPending && <Loader2 className="size-4 animate-spin" />}
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
