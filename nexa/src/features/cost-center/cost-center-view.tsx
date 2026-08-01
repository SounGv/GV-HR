"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Wallet, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { costCenterCreateSchema, type CostCenterRow } from "./schema";
import { useCostCenters, useCreateCostCenter, useUpdateCostCenter, useDeleteCostCenter } from "./hooks";

export function CostCenterView() {
  const { can } = useAuth();
  const canManage = can("admin:update");
  const { data, isLoading, isError, refetch } = useCostCenters();

  const [editing, setEditing] = useState<CostCenterRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
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
                  <Button variant="ghost" size="icon-sm" aria-label="แก้ไข" onClick={() => { setEditing(c); setDialogOpen(true); }}>
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

      <CostCenterDialog key={editing?.id ?? "new"} open={dialogOpen} onOpenChange={setDialogOpen} item={editing} />

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

function CostCenterDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: CostCenterRow | null;
}) {
  const createMut = useCreateCostCenter();
  const updateMut = useUpdateCostCenter();
  const [form, setForm] = useState({
    code: item?.code ?? "",
    name: item?.name ?? "",
    description: item?.description ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = createMut.isPending || updateMut.isPending;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = costCenterCreateSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) if (!fe[String(i.path[0])]) fe[String(i.path[0])] = i.message;
      setErrors(fe);
      return;
    }
    try {
      if (item) await updateMut.mutateAsync({ id: item.id, input: parsed.data });
      else await createMut.mutateAsync(parsed.data);
      toast.success(item ? "บันทึกแล้ว" : "เพิ่มศูนย์ต้นทุนแล้ว");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "แก้ไขศูนย์ต้นทุน" : "เพิ่มศูนย์ต้นทุน"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="รหัส" required error={errors.code}>
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} />
          </Field>
          <Field label="ชื่อศูนย์ต้นทุน" required error={errors.name}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="คำอธิบาย" error={errors.description}>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
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
