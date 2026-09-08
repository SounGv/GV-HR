"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { ApiError } from "@/lib/api/client";
import { RATER_LABEL } from "./labels";
import { useEvaluationRaterWeights, useUpdateEvaluationRaterWeights } from "./hooks";
import type { EvaluationRaterWeights, RaterType } from "./types";

const RATER_ORDER: RaterType[] = ["MANAGER", "SELF", "PEER", "UPWARD", "HR_EXEC"];
const DEFAULT_FORM: EvaluationRaterWeights = { MANAGER: 40, SELF: 20, PEER: 30, UPWARD: 10, HR_EXEC: 0 };

/** HR-scoped (campaign:update) — same Settings area as the score-band
 * thresholds. Weight per rater type feeding the blended overallScore/
 * scorePercent (see computeAndStoreScore in campaign/service.ts) — a rater
 * type nobody submitted this round drops out entirely rather than counting
 * as 0, so the remaining types' weights are implicitly renormalized. */
export function EvaluationRaterWeightsForm() {
  const { data, isLoading, isError, refetch } = useEvaluationRaterWeights();
  const updateMutation = useUpdateEvaluationRaterWeights();
  const [form, setForm] = useState<EvaluationRaterWeights>(DEFAULT_FORM);

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data]);

  const total = RATER_ORDER.reduce((sum, k) => sum + (form[k] || 0), 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  async function submit() {
    if (!totalOk) {
      toast.error("น้ำหนักรวมทุกประเภทต้องเท่ากับ 100");
      return;
    }
    try {
      await updateMutation.mutateAsync(form);
      toast.success("บันทึกน้ำหนักคะแนนเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;

  return (
    <Card className="max-w-lg space-y-4 p-5">
      <p className="text-sm text-muted-foreground">
        น้ำหนักคะแนน (%) ต่อประเภทผู้ประเมิน ใช้คำนวณคะแนนรวมของทุกรอบประเมิน — ประเภทที่ไม่มีใครส่งคำตอบในรอบนั้นจะถูกข้าม
        แล้วกระจายน้ำหนักที่เหลือให้ประเภทที่มีคนตอบจริงแทน รวมกันต้องได้ 100%
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {RATER_ORDER.map((type) => (
          <label key={type} className="space-y-1.5 text-sm">
            <span className="font-medium text-foreground">{RATER_LABEL[type]} (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={form[type]}
              onChange={(e) => setForm((f) => ({ ...f, [type]: Number(e.target.value) }))}
            />
          </label>
        ))}
      </div>
      <p className={`text-sm ${totalOk ? "text-muted-foreground" : "text-destructive"}`}>
        รวม {total}% {!totalOk && "— ต้องเท่ากับ 100%"}
      </p>
      <Button onClick={submit} disabled={updateMutation.isPending}>
        บันทึก
      </Button>
    </Card>
  );
}
