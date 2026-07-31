"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useWorkflows, useCreateRequest } from "./hooks";

export function RequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: wfData } = useWorkflows(true);
  const workflows = wfData?.data ?? [];
  const createMut = useCreateRequest();

  const [workflowId, setWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setWorkflowId("");
      setTitle("");
      setDetail("");
      setAmount("");
    }
  }, [open]);

  const selected = workflows.find((w) => w.id === workflowId);

  async function submit() {
    if (!workflowId) return toast.error("กรุณาเลือกเวิร์กโฟลว์");
    if (!title.trim()) return toast.error("กรุณาระบุหัวข้อ");
    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) return toast.error("จำนวนเงินไม่ถูกต้อง");
    try {
      await createMut.mutateAsync({
        workflowId,
        title: title.trim(),
        detail: detail.trim() || undefined,
        amount: amount || undefined,
      });
      toast.success("ส่งคำขอเรียบร้อย");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ส่งคำขออนุมัติ</DialogTitle>
          <DialogDescription>เลือกเวิร์กโฟลว์แล้วกรอกรายละเอียดคำขอ</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>เวิร์กโฟลว์</Label>
            <Select value={workflowId} onValueChange={(v) => setWorkflowId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกเวิร์กโฟลว์" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                ขั้นอนุมัติ: {selected.steps.map((s) => s.approverRole).join(" → ")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>หัวข้อ</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ขอจัดซื้อคอมพิวเตอร์" />
          </div>
          <div className="space-y-1.5">
            <Label>จำนวนเงิน (ถ้ามี)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>รายละเอียด</Label>
            <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMut.isPending}>
            ยกเลิก
          </Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="size-4 animate-spin" />}
            ส่งคำขอ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
