"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Building, MapPin, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { branchCreateSchema, type BranchRow } from "./schema";
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from "./hooks";

export function BranchView() {
  const { can } = useAuth();
  const canManage = can("admin:update");
  const { data, isLoading, isError, refetch } = useBranches();

  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null);
  const deleteMut = useDeleteBranch();

  const branches = data?.data ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(b: BranchRow) {
    setEditing(b);
    setDialogOpen(true);
  }

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
          <Button onClick={openCreate}>
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
                  <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" onClick={() => openEdit(b)}>
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

      <BranchDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} branch={editing} />

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

function BranchDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branch: BranchRow | null;
}) {
  const createMut = useCreateBranch();
  const updateMut = useUpdateBranch();
  const [form, setForm] = useState({
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = createMut.isPending || updateMut.isPending;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = branchCreateSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!fe[String(i.path[0])]) fe[String(i.path[0])] = i.message;
      setErrors(fe);
      return;
    }
    try {
      if (branch) await updateMut.mutateAsync({ id: branch.id, input: parsed.data });
      else await createMut.mutateAsync(parsed.data);
      toast.success(branch ? "บันทึกสาขาแล้ว" : "เพิ่มสาขาแล้ว");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{branch ? "แก้ไขสาขา" : "เพิ่มสาขา"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="ชื่อสาขา" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="รหัสสาขา" required error={errors.code}>
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} />
          </Field>
          <Field label="ที่อยู่" error={errors.address}>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="โทรศัพท์" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
