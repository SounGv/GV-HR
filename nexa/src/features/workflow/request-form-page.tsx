"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
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
import { ApiError } from "@/lib/api/client";
import { useWorkflows, useCreateRequest } from "./hooks";

const FORM_ID = "request-form";
const LIST = "/workflows";

export function RequestFormPage() {
  const router = useRouter();
  const { data: wfData } = useWorkflows(true);
  const workflows = wfData?.data ?? [];
  const createMut = useCreateRequest();

  const [workflowId, setWorkflowId] = useState("");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");

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
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <FormPageShell
      breadcrumbs={[{ label: "เวิร์กโฟลว์อนุมัติ", href: LIST }, { label: "ส่งคำขอ" }]}
      backHref={LIST}
      title="ส่งคำขออนุมัติ"
      description="เลือกเวิร์กโฟลว์แล้วกรอกรายละเอียดคำขอ"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST)}
      actions={[{ label: "ส่งคำขอ", primary: true }]}
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="max-w-md space-y-4"
      >
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
          <Label htmlFor="req-title">หัวข้อ</Label>
          <Input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ขอจัดซื้อคอมพิวเตอร์" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-amount">จำนวนเงิน (ถ้ามี)</Label>
          <Input id="req-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-detail">รายละเอียด</Label>
          <Textarea id="req-detail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </div>
      </form>
    </FormPageShell>
  );
}
