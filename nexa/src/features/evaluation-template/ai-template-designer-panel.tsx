"use client";

import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useGenerateAiTemplateDesign } from "./hooks";
import type { AiTemplateDraft, AiTemplateScope, SectionFormValues, TemplateOption } from "./types";

const SCOPE_LABEL: Record<AiTemplateScope, string> = {
  department: "เฉพาะแผนก",
  company: "ทั้งบริษัท",
};

function draftToSections(draft: AiTemplateDraft): SectionFormValues[] {
  return draft.sections.map((s, si) => ({
    name: s.name,
    order: si,
    questions: s.questions.map((q, qi) => {
      let options: TemplateOption[] | undefined;
      if (q.answerType === "NUMERIC") {
        options = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n), score: n }));
      } else if (q.answerType === "YES_NO") {
        options = [
          { value: "YES", label: "ใช่", score: 1 },
          { value: "NO", label: "ไม่ใช่", score: 0 },
        ];
      } else if (q.answerType === "LETTER" || q.answerType === "CHOICE") {
        options = (q.options ?? []).map((o) => ({ value: o.label, label: o.label, score: o.score }));
      }
      return {
        text: q.text,
        helpText: q.helpText,
        answerType: q.answerType,
        options,
        weight: Math.min(10, Math.max(1, Math.round(q.weight) || 1)),
        required: q.required,
        order: qi,
        visibleTo: [],
      };
    }),
  }));
}

/**
 * Inline AI-assist panel embedded in the template builder page. Unlike the
 * campaign AiDesignerPanel (which persists Competency rows immediately on
 * "apply"), this only ever produces a DRAFT — applying just merges the
 * draft into the builder's local sections state so HR can still edit/reorder
 * everything and must Preview before the template can ever go ACTIVE.
 */
export function AiTemplateDesignerPanel({
  onApply,
  onClose,
  currentDraft,
}: {
  onApply: (values: { name: string; description: string; sections: SectionFormValues[]; rationale: string }) => void;
  onClose: () => void;
  /** When provided with at least one real question, enables "ให้ AI ช่วยตรวจสอบ"
   * mode — AI critiques this draft instead of generating from scratch. */
  currentDraft?: { name: string; description?: string; sections: SectionFormValues[] };
}) {
  const hasDraftToCritique = !!currentDraft?.sections.some((s) => s.questions.some((q) => q.text.trim()));
  const [scope, setScope] = useState<AiTemplateScope>("company");
  const [targetId, setTargetId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [aiMode, setAiMode] = useState<"generate" | "critique">(hasDraftToCritique ? "critique" : "generate");
  const [draft, setDraft] = useState<AiTemplateDraft | null>(null);
  const [findings, setFindings] = useState<string[] | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const { data: orgData } = useOrgOptions();
  const departments = orgData?.data.departments ?? [];

  const generate = useGenerateAiTemplateDesign();
  const needsTarget = scope === "department";
  const isCritique = aiMode === "critique";

  async function generateDraft() {
    if (needsTarget && !targetId) {
      toast.error("กรุณาเลือกแผนกก่อน");
      return;
    }
    try {
      const res = await generate.mutateAsync({
        mode: aiMode,
        scope,
        targetId: needsTarget ? targetId : undefined,
        instruction: instruction.trim() || undefined,
        draft: isCritique ? currentDraft : undefined,
      });
      if (!res.data.configured) {
        setNotConfigured(true);
        setDraft(null);
        setFindings(null);
        return;
      }
      setNotConfigured(false);
      setDraft(res.data.draft);
      setFindings(res.data.findings);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  function applyDraft() {
    if (!draft) return;
    onApply({ name: draft.name, description: draft.description, sections: draftToSections(draft), rationale: draft.rationale });
    toast.success('นำผลลัพธ์จาก AI มาใช้แล้ว — ตรวจสอบและกด "ดูตัวอย่าง" ก่อนเปิดใช้งาน');
    onClose();
  }

  return (
    <Card className="gap-4 border-primary/30 bg-primary/5 p-4">
      <CardHeader className="flex-row items-center justify-between gap-2 p-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" /> AI ออกแบบแบบประเมิน
        </CardTitle>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="ปิด">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {hasDraftToCritique && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={isCritique ? "default" : "outline"}
              onClick={() => setAiMode("critique")}
            >
              ตรวจสอบสิ่งที่มีอยู่
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!isCritique ? "default" : "outline"}
              onClick={() => setAiMode("generate")}
            >
              ออกแบบใหม่ทั้งหมด
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">ขอบเขต</label>
            <Select
              value={scope}
              onValueChange={(v) => {
                setScope((v as AiTemplateScope) ?? "company");
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCOPE_LABEL) as AiTemplateScope[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTarget && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">แผนก</label>
              <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
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
            placeholder="เช่น เน้นวินัย การขาดลามาสาย คุณภาพงาน และข้อเสนอแนะจากหัวหน้า"
            rows={2}
            className="resize-none bg-background"
          />
        </div>

        <Button type="button" onClick={generateDraft} disabled={generate.isPending} className="w-full">
          {generate.isPending && <Loader2 className="size-4 animate-spin" />}
          {isCritique ? "ให้ AI ช่วยตรวจสอบ" : "สร้างแบบประเมิน"}
        </Button>

        {notConfigured && (
          <Card className="p-3 text-sm text-muted-foreground">
            ระบบ AI Assistant ยังไม่ได้ตั้งค่า API key จึงยังสร้างแบบประเมินอัตโนมัติไม่ได้
          </Card>
        )}

        {findings && findings.length > 0 && (
          <Card className="gap-1.5 bg-background p-3 text-sm">
            <p className="font-medium text-foreground">ข้อสังเกตจาก AI</p>
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
              {findings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </Card>
        )}

        {draft && (
          <div className="space-y-3">
            <Card className="gap-1 bg-background p-3 text-sm">
              <p className="font-medium text-foreground">{draft.name}</p>
              <p className="text-muted-foreground">{draft.description}</p>
            </Card>
            <div className="space-y-1.5">
              {draft.sections.map((s, i) => (
                <div key={i} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.questions.length} ข้อย่อย</p>
                </div>
              ))}
            </div>
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="font-medium">เหตุผลของ AI:</span> {draft.rationale}
            </p>
            <Button type="button" onClick={applyDraft} className="w-full">
              ใช้ผลลัพธ์นี้
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
