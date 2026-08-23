"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { useEvaluationThresholds, useUpdateEvaluationThresholds } from "./hooks";

/** HR-scoped (campaign:update) — kept separate from the Super-Admin-gated
 * company profile form so HR Manager can actually reach it. */
export function EvaluationThresholdsForm() {
  const { data, isLoading, isError, refetch } = useEvaluationThresholds();
  const updateMutation = useUpdateEvaluationThresholds();
  const [form, setForm] = useState({ evalThresholdUrgentMax: 66.67, evalThresholdWatchMax: 74.99, evalThresholdGoodMin: 83.33 });

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  async function submit() {
    try {
      await updateMutation.mutateAsync(form);
      toast.success("บันทึกเกณฑ์คะแนนเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;

  return (
    <Card className="max-w-lg space-y-4 p-5">
      <p className="text-sm text-muted-foreground">
        ใช้ตัดสินสถานะสีของผลประเมินทั่วทั้งระบบ — คะแนน ≤ เกณฑ์ &quot;ต้องแก้ไขเร่งด่วน&quot; จะสร้างแผนพัฒนาอัตโนมัติและแจ้งเตือนหัวหน้า/HR
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">ต้องแก้ไขเร่งด่วน ถ้า ≤ (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.evalThresholdUrgentMax}
            onChange={(e) => setForm((f) => ({ ...f, evalThresholdUrgentMax: Number(e.target.value) }))}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">ต้องติดตาม ถ้า ≤ (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.evalThresholdWatchMax}
            onChange={(e) => setForm((f) => ({ ...f, evalThresholdWatchMax: Number(e.target.value) }))}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-foreground">ดี/ดีเยี่ยม ถ้า ≥ (%)</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={form.evalThresholdGoodMin}
            onChange={(e) => setForm((f) => ({ ...f, evalThresholdGoodMin: Number(e.target.value) }))}
          />
        </label>
      </div>
      <Button onClick={submit} disabled={updateMutation.isPending}>
        บันทึก
      </Button>
    </Card>
  );
}
