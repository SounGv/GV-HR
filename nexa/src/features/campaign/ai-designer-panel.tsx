"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useApplyAiDesign, useGenerateAiDesign } from "./hooks";
import type { AiDesignerDraft, AiDesignerScope } from "./types";

const SCOPE_LABEL: Record<AiDesignerScope, string> = {
  employee: "รายบุคคล",
  team: "ทีม (ตามหัวหน้างาน)",
  department: "แผนก",
  company: "ทั้งบริษัท",
};

/**
 * Inline (not a Dialog/overlay) AI-assist panel embedded directly in the
 * campaign create/edit page — expands in place, no modal, per the
 * full-page-only editing rule.
 */
export function AiDesignerPanel({
  onApply,
  onClose,
}: {
  onApply: (items: { competencyId: string; weight: number }[], rationale: string) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<AiDesignerScope>("employee");
  const [targetId, setTargetId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<AiDesignerDraft | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const { data: orgData } = useOrgOptions();
  const employees = orgData?.data.managers ?? [];
  const departments = orgData?.data.departments ?? [];

  const generate = useGenerateAiDesign();
  const apply = useApplyAiDesign();

  const needsTarget = scope !== "company";

  async function generateDraft() {
    if (needsTarget && !targetId) {
      toast.error("กรุณาเลือกเป้าหมายก่อน");
      return;
    }
    try {
      const res = await generate.mutateAsync({
        scope,
        targetId: needsTarget ? targetId : undefined,
        instruction: instruction.trim() || undefined,
      });
      if (!res.data.configured) {
        setNotConfigured(true);
        setDraft(null);
        return;
      }
      setNotConfigured(false);
      setDraft(res.data.draft);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างเกณฑ์การประเมินไม่สำเร็จ");
    }
  }

  function updateWeight(index: number, weight: number) {
    if (!draft) return;
    const next = { ...draft, competencies: [...draft.competencies] };
    next.competencies[index] = { ...next.competencies[index], weight };
    setDraft(next);
  }

  async function applyDraft() {
    if (!draft) return;
    try {
      const res = await apply.mutateAsync(
        draft.competencies.map((c) => ({ name: c.name, description: c.description, weight: c.weight })),
      );
      onApply(
        res.data.map((r) => ({ competencyId: r.competencyId, weight: r.weight })),
        draft.rationale,
      );
      toast.success("นำผลลัพธ์จาก AI มาใช้แล้ว");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "นำผลลัพธ์มาใช้ไม่สำเร็จ");
    }
  }

  return (
    <Card className="gap-4 border-primary/30 bg-primary/5 p-4">
      <CardHeader className="flex-row items-center justify-between gap-2 p-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" /> AI ออกแบบเกณฑ์การประเมิน
        </CardTitle>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิด">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ขอบเขต</label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope((v as AiDesignerScope) ?? "employee");
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCOPE_LABEL) as AiDesignerScope[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTarget && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {scope === "employee" ? "พนักงาน" : scope === "team" ? "หัวหน้าทีม" : "แผนก"}
              </label>
              <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  {scope === "department"
                    ? departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))
                    : employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName} ({e.employeeCode})
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">คำสั่ง / จุดเน้น (ไม่บังคับ)</label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="เช่น เน้นทักษะการเป็นผู้นำทีมและการส่งมอบงานตรงเวลา"
            rows={2}
            className="resize-none bg-background"
          />
        </div>

        <Button type="button" onClick={generateDraft} disabled={generate.isPending} className="w-full">
          {generate.isPending && <Loader2 className="size-4 animate-spin" />} สร้างเกณฑ์การประเมิน
        </Button>

        {notConfigured && (
          <Card className="p-3 text-sm text-muted-foreground">
            ระบบ AI Assistant ยังไม่ได้ตั้งค่า API key จึงยังสร้างแบบประเมินอัตโนมัติไม่ได้
          </Card>
        )}

        {draft && (
          <div className="space-y-3">
            <Card className="gap-1 bg-background p-3 text-sm">
              <p className="font-medium text-primary">จุดเน้น</p>
              <p className="text-muted-foreground">{draft.focus}</p>
            </Card>
            <div className="space-y-1.5">
              {draft.competencies.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={c.weight}
                    onChange={(e) => updateWeight(i, Number(e.target.value) || 1)}
                    className="w-16 shrink-0"
                  />
                </div>
              ))}
            </div>
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="font-medium">เหตุผลของ AI:</span> {draft.rationale}
            </p>
            <Button type="button" onClick={applyDraft} disabled={apply.isPending} className="w-full">
              {apply.isPending && <Loader2 className="size-4 animate-spin" />} ใช้ผลลัพธ์นี้
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
