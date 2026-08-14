"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTemplateDesignerPanel } from "@/features/evaluation-template/ai-template-designer-panel";
import { SectionListEditor, emptySection } from "@/features/evaluation-template/template-builder-fields";
import { TemplateFormRenderer } from "@/features/evaluation-template/template-renderer";
import { useEvaluationTemplates } from "@/features/evaluation-template/hooks";
import type { SectionFormValues, TemplateSection } from "@/features/evaluation-template/types";

export interface TemplateDraft {
  mode: "existing" | "new";
  templateId: string | null;
  name: string;
  description: string;
  sections: SectionFormValues[];
  aiGenerated: boolean;
  aiRationale: string;
}

export function emptyTemplateDraft(): TemplateDraft {
  return { mode: "new", templateId: null, name: "", description: "", sections: [emptySection(0)], aiGenerated: false, aiRationale: "" };
}

/** Live-preview shape — mirrors the same conversion `TemplateFormPage` uses. */
export function draftToRendererSections(sections: SectionFormValues[]): TemplateSection[] {
  return sections.map((s, si) => ({
    id: `preview-section-${si}`,
    name: s.name || "(ยังไม่มีชื่อหมวด)",
    order: si,
    questions: s.questions.map((q, qi) => ({
      id: `preview-question-${si}-${qi}`,
      text: q.text || "(ยังไม่มีคำถาม)",
      helpText: q.helpText ?? null,
      answerType: q.answerType,
      options: q.options ?? null,
      weight: q.weight,
      required: q.required,
      order: qi,
      visibleTo: q.visibleTo,
    })),
  }));
}

/** Step 4 — pick an existing ACTIVE template to reuse as-is, or start a new one from scratch. */
export function TemplateSelectStep({ draft, onChange }: { draft: TemplateDraft; onChange: (draft: TemplateDraft) => void }) {
  const { data } = useEvaluationTemplates("ACTIVE");
  const templates = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={draft.mode === "existing" ? "default" : "outline"} onClick={() => onChange({ ...draft, mode: "existing" })}>
          ใช้แบบประเมินที่มีอยู่
        </Button>
        <Button
          type="button"
          size="sm"
          variant={draft.mode === "new" ? "default" : "outline"}
          onClick={() => onChange({ ...emptyTemplateDraft(), name: draft.name })}
        >
          <Plus className="size-4" /> สร้างแบบประเมินใหม่
        </Button>
      </div>

      {draft.mode === "existing" ? (
        templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีแบบประเมินที่พร้อมใช้งาน (สถานะ &ldquo;พร้อมใช้งาน&rdquo;) — เลือก &ldquo;สร้างแบบประเมินใหม่&rdquo; แทน</p>
        ) : (
          <Select value={draft.templateId ?? ""} onValueChange={(v) => onChange({ ...draft, templateId: v ?? null })}>
            <SelectTrigger className="w-full sm:w-96">
              <SelectValue placeholder="เลือกแบบประเมิน" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.sectionCount} หมวด · {t.questionCount} ข้อย่อย)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:max-w-md">
          <Input placeholder="ชื่อแบบประเมิน" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
          <Textarea rows={2} placeholder="รายละเอียด (ไม่บังคับ)" value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} />
        </div>
      )}
    </div>
  );
}

/** Step 5 — build sections/questions, reusing the exact editor from the standalone Template builder. */
export function QuestionsStep({ draft, onChange }: { draft: TemplateDraft; onChange: (draft: TemplateDraft) => void }) {
  return <SectionListEditor sections={draft.sections} onChange={(sections) => onChange({ ...draft, sections })} />;
}

/** Step 6 — AI ช่วยตรวจ/เสนอ: same designer panel the standalone Template builder uses. */
export function AiReviewStep({ draft, onChange }: { draft: TemplateDraft; onChange: (draft: TemplateDraft) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        ให้ AI ช่วยตรวจดูหมวด/คำถามที่ตั้งไว้ หรือให้ AI ออกแบบให้ใหม่ทั้งชุด — ผลลัพธ์เป็นแบบร่าง แก้ไขต่อได้ก่อนไปขั้นตอนถัดไป
      </p>
      <AiTemplateDesignerPanel
        onApply={(v) => onChange({ ...draft, name: v.name, description: v.description, sections: v.sections, aiGenerated: true, aiRationale: v.rationale })}
        onClose={() => {}}
        currentDraft={{ name: draft.name, description: draft.description, sections: draft.sections }}
      />
    </div>
  );
}

/** Step 7 — preview exactly as a rater will see it. */
export function PreviewStep({ draft, existingSections }: { draft: TemplateDraft; existingSections: TemplateSection[] | null }) {
  const sections = draft.mode === "existing" ? existingSections ?? [] : draftToRendererSections(draft.sections);
  return (
    <Card className="max-w-2xl space-y-1 p-4">
      <p className="text-lg font-semibold text-foreground">{draft.name || "(ยังไม่มีชื่อ)"}</p>
      {draft.description && <p className="text-sm text-muted-foreground">{draft.description}</p>}
      <div className="pt-2">
        <TemplateFormRenderer sections={sections} mode="preview" />
      </div>
    </Card>
  );
}
