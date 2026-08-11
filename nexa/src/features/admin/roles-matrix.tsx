"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Lock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { MODULES } from "@/config/permissions";
import { useRoles, useUpdateRole, useDeleteRole } from "./hooks";
import type { AdminRole } from "./types";

const ACTION_LABEL: Record<string, string> = {
  read: "ดู",
  create: "เพิ่ม",
  update: "แก้ไข",
  delete: "ลบ",
  approve: "อนุมัติ",
  export: "ส่งออก",
  offsite: "เช็คอินนอกพื้นที่",
};

export function RolesMatrix() {
  const searchParams = useSearchParams();
  const { data, isLoading, isError, refetch } = useRoles();
  const roles = useMemo(() => data?.data ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AdminRole | null>(null);

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;
  const updateMut = useUpdateRole(selected?.id ?? "");
  const deleteMut = useDeleteRole();

  // Select the role just created (via ?role=id from the create page), else the first one.
  useEffect(() => {
    if (selectedId || roles.length === 0) return;
    const fromQuery = searchParams.get("role");
    if (fromQuery && roles.some((r) => r.id === fromQuery)) setSelectedId(fromQuery);
    else setSelectedId(roles[0].id);
  }, [roles, selectedId, searchParams]);
  // Re-sync the editable permission set only when the selected role or the
  // underlying data changes — never on every render (which would discard edits).
  useEffect(() => {
    const role = roles.find((r) => r.id === selectedId) ?? roles[0] ?? null;
    if (role) setPerms(new Set(role.permissionKeys));
  }, [selectedId, roles]);

  const isAll = selected?.permissionKeys.includes("*");
  const locked = !selected || selected.isSystem;

  const dirty =
    selected &&
    !isAll &&
    (perms.size !== selected.permissionKeys.length ||
      [...perms].some((k) => !selected.permissionKeys.includes(k)));

  function toggle(key: string, checked: boolean) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleModule(moduleKey: string, actions: readonly string[], checked: boolean) {
    setPerms((prev) => {
      const next = new Set(prev);
      for (const a of actions) {
        const key = `${moduleKey}:${a}`;
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  async function save() {
    if (!selected) return;
    try {
      await updateMut.mutateAsync({ permissions: [...perms] });
      toast.success("บันทึกสิทธิ์เรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบบทบาทเรียบร้อย");
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={6} />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Roles list */}
      <Card className="h-fit gap-1 p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">บทบาท</span>
          <Button variant="ghost" size="icon-sm" aria-label="เพิ่มบทบาท" render={<Link href="/admin/roles/new" />}>
            <Plus className="size-4" />
          </Button>
        </div>
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedId(r.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
              selected?.id === r.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-1.5">
              {r.isSystem ? <ShieldCheck className="size-3.5" /> : null}
              {r.name}
            </span>
            <span className="text-xs text-muted-foreground">{r.userCount}</span>
          </button>
        ))}
      </Card>

      {/* Permission matrix */}
      <Card className="gap-0 p-0">
        {selected && (
          <>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {selected.name}
                  {selected.isSystem && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <Lock className="size-3" /> บทบาทระบบ
                    </span>
                  )}
                </div>
                {selected.description && (
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!selected.isSystem && selected.userCount === 0 && (
                  <Button variant="ghost" size="icon-sm" aria-label="ลบบทบาท" onClick={() => setDeleteTarget(selected)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
                {!locked && (
                  <Button size="sm" disabled={!dirty || updateMut.isPending} onClick={save}>
                    {updateMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    บันทึก
                  </Button>
                )}
              </div>
            </div>

            {isAll ? (
              <div className="p-6 text-sm text-muted-foreground">
                บทบาทนี้มีสิทธิ์ทั้งหมดในระบบ (สิทธิ์เต็ม)
              </div>
            ) : (
              <div className="divide-y divide-border">
                {MODULES.map((m) => (
                  <div key={m.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="w-40 shrink-0 text-sm font-medium">{m.label}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {m.actions.map((a) => {
                        const key = `${m.key}:${a}`;
                        return (
                          <label key={key} className="flex items-center gap-1.5 text-sm">
                            <Checkbox
                              checked={perms.has(key)}
                              disabled={locked}
                              onCheckedChange={(c) => toggle(key, c === true)}
                            />
                            {ACTION_LABEL[a] ?? a}
                          </label>
                        );
                      })}
                      {!locked && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() =>
                            toggleModule(
                              m.key,
                              m.actions,
                              !m.actions.every((a) => perms.has(`${m.key}:${a}`)),
                            )
                          }
                        >
                          สลับทั้งหมด
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบบทบาท"
        description={deleteTarget ? `ต้องการลบบทบาท "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
