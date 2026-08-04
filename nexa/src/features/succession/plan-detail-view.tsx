"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { fullName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useAddCandidate, usePlan, useRemoveCandidate, useUpdateCandidate } from "./hooks";
import { READINESS_LABEL, READINESS_TONE } from "./readiness";
import type { SuccessionReadiness } from "./types";

export function PlanDetailView({ planId }: { planId: string }) {
  const { can } = useAuth();
  const canManage = can("succession:update");
  const { data, isLoading, isError, refetch } = usePlan(planId);
  const plan = data?.data;

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !plan) return <TableLoadingState rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/performance"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> กลับ
        </Link>
        {canManage && (
          <Button variant="outline" size="sm" render={<Link href={`/performance/succession/${planId}/edit`} />}>
            <Pencil className="size-4" /> แก้ไข
          </Button>
        )}
      </div>

      <Card className="gap-1 p-4">
        <p className="font-medium text-foreground">{plan.position.title}</p>
        <p className="text-xs text-muted-foreground">
          ผู้ดำรงตำแหน่ง: {plan.incumbentEmployee ? fullName(plan.incumbentEmployee.firstName, plan.incumbentEmployee.lastName) : "ว่าง"}
        </p>
        {plan.notes && <p className="mt-1 text-sm text-muted-foreground">{plan.notes}</p>}
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">ผู้สืบทอด ({plan.candidates.length})</h2>
        {canManage && <AddCandidateDialog planId={planId} existingIds={plan.candidates.map((c) => c.employee.id)} />}
      </div>

      {plan.candidates.length === 0 ? (
        <EmptyState icon={Plus} title="ยังไม่มีผู้สืบทอด" />
      ) : (
        <div className="space-y-2">
          {plan.candidates.map((c) => (
            <CandidateRow key={c.id} candidate={c} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  canManage,
}: {
  candidate: { id: string; readiness: SuccessionReadiness; note: string | null; employee: { id: string; employeeCode: string; firstName: string; lastName: string } };
  canManage: boolean;
}) {
  const updateMutation = useUpdateCandidate();
  const removeMutation = useRemoveCandidate();
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function changeReadiness(readiness: SuccessionReadiness) {
    try {
      await updateMutation.mutateAsync({ id: candidate.id, input: { readiness } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function confirmDelete() {
    try {
      await removeMutation.mutateAsync(candidate.id);
      toast.success("ลบผู้สืบทอดแล้ว");
      setConfirmRemove(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{fullName(candidate.employee.firstName, candidate.employee.lastName)}</p>
        <p className="text-xs text-muted-foreground">
          {candidate.employee.employeeCode}
          {candidate.note && <> · {candidate.note}</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canManage ? (
          <Select value={candidate.readiness} onValueChange={(v) => v && changeReadiness(v as SuccessionReadiness)}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(READINESS_LABEL) as SuccessionReadiness[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {READINESS_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", READINESS_TONE[candidate.readiness])}>
            {READINESS_LABEL[candidate.readiness]}
          </span>
        )}
        {canManage && (
          <Button variant="ghost" size="icon-sm" aria-label="ลบ" onClick={() => setConfirmRemove(true)}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="ลบผู้สืบทอดคนนี้?"
        confirmLabel="ลบ"
        destructive
        loading={removeMutation.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

function AddCandidateDialog({ planId, existingIds }: { planId: string; existingIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [readiness, setReadiness] = useState<SuccessionReadiness>("ONE_TO_TWO_YEARS");
  const [note, setNote] = useState("");
  const { data: orgData } = useOrgOptions();
  const candidates = (orgData?.data.managers ?? []).filter((e) => !existingIds.includes(e.id));
  const addMutation = useAddCandidate(planId);

  async function submit() {
    if (!employeeId) {
      toast.error("กรุณาเลือกพนักงาน");
      return;
    }
    try {
      await addMutation.mutateAsync({ employeeId, readiness, note: note.trim() || undefined });
      toast.success("เพิ่มผู้สืบทอดแล้ว");
      setOpen(false);
      setEmployeeId("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "เพิ่มไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> เพิ่มผู้สืบทอด
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เพิ่มผู้สืบทอด</DialogTitle>
          <DialogDescription>เลือกพนักงานและระดับความพร้อม</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกพนักงาน" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={readiness} onValueChange={(v) => v && setReadiness(v as SuccessionReadiness)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(READINESS_LABEL) as SuccessionReadiness[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {READINESS_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea rows={2} placeholder="หมายเหตุ (ไม่บังคับ)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="w-full" onClick={submit} disabled={addMutation.isPending}>
            เพิ่ม
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
