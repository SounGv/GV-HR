"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useCreatePlan, useUpdatePlan } from "./hooks";
import type { SuccessionPlanDetail } from "./types";

const FORM_ID = "succession-plan-form";
const LIST = "/performance";

export function SuccessionPlanFormPage({ plan }: { plan?: SuccessionPlanDetail }) {
  const router = useRouter();
  const isEdit = !!plan;
  const { data: orgData } = useOrgOptions();
  const positions = orgData?.data.positions ?? [];
  const employees = orgData?.data.managers ?? [];

  const [positionId, setPositionId] = useState(plan?.position.id ?? "");
  const [incumbentId, setIncumbentId] = useState(plan?.incumbentEmployee?.id ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");

  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan(plan?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!positionId) {
      toast.error("กรุณาเลือกตำแหน่งงาน");
      return;
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          incumbentEmployeeId: incumbentId || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(`/performance/succession/${plan.id}`);
      } else {
        const res = await createMutation.mutateAsync({
          positionId,
          incumbentEmployeeId: incumbentId || undefined,
          notes: notes.trim() || undefined,
        });
        toast.success("สร้างแผนสืบทอดตำแหน่งเรียบร้อย");
        router.push(`/performance/succession/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: isEdit ? "บันทึก" : "สร้างแผน", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ประเมินผล", href: LIST }, { label: isEdit ? "แก้ไขแผนสืบทอด" : "สร้างแผนสืบทอด" }]}
      backHref={isEdit ? `/performance/succession/${plan.id}` : LIST}
      title={isEdit ? "แก้ไขแผนสืบทอดตำแหน่ง" : "สร้างแผนสืบทอดตำแหน่ง"}
      description="ระบุตำแหน่งสำคัญและผู้ดำรงตำแหน่งปัจจุบัน"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <form id={FORM_ID} className="max-w-lg space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">ตำแหน่งงาน</label>
          <Select value={positionId} onValueChange={(v) => setPositionId(v ?? "")} disabled={isEdit}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกตำแหน่งงาน" />
            </SelectTrigger>
            <SelectContent>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">ผู้ดำรงตำแหน่งปัจจุบัน (ถ้ามี)</label>
          <Select value={incumbentId} onValueChange={(v) => setIncumbentId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกพนักงาน" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">หมายเหตุ</label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </FormPageShell>
  );
}
