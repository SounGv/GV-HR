"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useRoles } from "@/features/admin/hooks";
import { useCreateWorkflow, useUpdateWorkflow } from "./hooks";
import type { ApprovalWorkflow, WorkflowStepDef } from "./types";

type Step = { name: string; approverRole: string };

export function WorkflowDialog({
  open,
  onOpenChange,
  workflow,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: ApprovalWorkflow | null;
}) {
  const isEdit = !!workflow;
  const { data: rolesData } = useRoles();
  const roles = rolesData?.data ?? [];

  const createMut = useCreateWorkflow();
  const updateMut = useUpdateWorkflow();
  const pending = createMut.isPending || updateMut.isPending;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<Step[]>([{ name: "", approverRole: "" }]);

  useEffect(() => {
    if (!open) return;
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? "");
      setActive(workflow.active);
      setSteps(
        workflow.steps.length
          ? workflow.steps.map((s) => ({ name: s.name, approverRole: s.approverRole }))
          : [{ name: "", approverRole: "" }],
      );
    } else {
      setName("");
      setDescription("");
      setActive(true);
      setSteps([{ name: "อนุมัติขั้นต้น", approverRole: "" }]);
    }
  }, [open, workflow]);

  function setStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, { name: "", approverRole: "" }]);
  }
  function removeStep(i: number) {
    setSteps((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function submit() {
    if (!name.trim()) return toast.error("กรุณาระบุชื่อเวิร์กโฟลว์");
    const cleaned = steps.filter((s) => s.name.trim() && s.approverRole);
    if (cleaned.length === 0) return toast.error("ต้องมีอย่างน้อย 1 ขั้นที่กรอกครบ");

    const stepDefs: WorkflowStepDef[] = cleaned.map((s, i) => ({
      order: i,
      name: s.name.trim(),
      approverRole: s.approverRole,
    }));

    try {
      if (isEdit && workflow) {
        await updateMut.mutateAsync({
          id: workflow.id,
          input: { name: name.trim(), description: description.trim() || undefined, steps: stepDefs, active },
        });
        toast.success("บันทึกเวิร์กโฟลว์แล้ว");
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          steps: stepDefs,
          active,
        });
        toast.success("สร้างเวิร์กโฟลว์แล้ว");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขเวิร์กโฟลว์" : "สร้างเวิร์กโฟลว์อนุมัติ"}</DialogTitle>
          <DialogDescription>กำหนดลำดับขั้นการอนุมัติและบทบาทผู้อนุมัติแต่ละขั้น</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อเวิร์กโฟลว์</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น อนุมัติจัดซื้อ" />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>ขั้นการอนุมัติ (ตามลำดับ)</Label>
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  className="flex-1"
                  placeholder="ชื่อขั้น เช่น หัวหน้าอนุมัติ"
                  value={s.name}
                  onChange={(e) => setStep(i, { name: e.target.value })}
                />
                <Select value={s.approverRole} onValueChange={(v) => setStep(i, { approverRole: v ?? "" })}>
                  <SelectTrigger className="w-40 shrink-0">
                    <SelectValue placeholder="บทบาท" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-destructive"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 1}
                  aria-label="ลบขั้น"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="size-4" /> เพิ่มขั้น
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">เปิดใช้งาน</p>
              <p className="text-xs text-muted-foreground">อนุญาตให้ส่งคำขอตามเวิร์กโฟลว์นี้</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "บันทึก" : "สร้าง"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
