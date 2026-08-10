"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/client";
import { AiTemplateDesignerPanel } from "./ai-template-designer-panel";
import { SectionEditor, emptySection } from "./template-builder-fields";
import { TemplateFormRenderer } from "./template-renderer";
import { useCreateEvaluationTemplate, useUpdateEvaluationTemplate } from "./hooks";
import type { SectionFormValues, TemplateDetail, TemplateSection } from "./types";

const FORM_ID = "evaluation-template-form";
const LIST = "/performance/templates";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแบบประเมิน"),
  description: z.string().trim().max(1000).optional(),
});
type FormSchema = z.infer<typeof formSchema>;

function toRendererSections(sections: SectionFormValues[]): TemplateSection[] {
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
    })),
  }));
}

export function TemplateFormPage({ template }: { template?: TemplateDetail }) {
  const router = useRouter();
  const isEdit = !!template;
  const locked = isEdit && template.status !== "DRAFT";

  const [sections, setSections] = useState<SectionFormValues[]>(
    template
      ? template.sections.map((s, si) => ({
          name: s.name,
          order: s.order ?? si,
          questions: s.questions.map((q, qi) => ({
            text: q.text,
            helpText: q.helpText ?? "",
            answerType: q.answerType,
            options: q.options ?? undefined,
            weight: q.weight,
            required: q.required,
            order: q.order ?? qi,
          })),
        }))
      : [emptySection(0)],
  );
  const [aiGenerated, setAiGenerated] = useState(template?.aiGenerated ?? false);
  const [aiRationale, setAiRationale] = useState(template?.aiRationale ?? "");
  const [showAiDesigner, setShowAiDesigner] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const createMutation = useCreateEvaluationTemplate();
  const updateMutation = useUpdateEvaluationTemplate(template?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: template?.name ?? "", description: template?.description ?? "" },
  });

  function updateSection(index: number, section: SectionFormValues) {
    const next = [...sections];
    next[index] = section;
    setSections(next);
  }

  function removeSection(index: number) {
    setSections(sections.filter((_, i) => i !== index));
  }

  function moveSection(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  }

  function handleAiApply(values: { name: string; description: string; sections: SectionFormValues[]; rationale: string }) {
    form.setValue("name", values.name);
    form.setValue("description", values.description);
    setSections(values.sections);
    setAiGenerated(true);
    setAiRationale(values.rationale);
  }

  async function onSubmit(values: FormSchema) {
    if (locked) {
      // Structural editing is locked, but name/description/status still go
      // through the normal update path (status changes use a dedicated
      // control on the detail page, not this form).
      try {
        await updateMutation.mutateAsync({ name: values.name, description: values.description });
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(`/performance/templates`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      }
      return;
    }

    if (sections.length === 0) {
      toast.error("ต้องมีอย่างน้อย 1 หมวด");
      return;
    }
    for (const s of sections) {
      if (!s.name.trim()) {
        toast.error("กรุณาระบุชื่อหมวดให้ครบทุกหมวด");
        return;
      }
      if (s.questions.length === 0) {
        toast.error(`หมวด "${s.name}" ต้องมีอย่างน้อย 1 ข้อย่อย`);
        return;
      }
      for (const q of s.questions) {
        if (!q.text.trim()) {
          toast.error("กรุณาระบุคำถามให้ครบทุกข้อ");
          return;
        }
        if (q.answerType !== "LONG_TEXT" && (!q.options || q.options.length < 2 || q.options.some((o) => !o.label.trim()))) {
          toast.error(`คำถาม "${q.text}" ต้องมีตัวเลือกอย่างน้อย 2 รายการ พร้อมความหมาย`);
          return;
        }
      }
    }

    const payload = {
      name: values.name,
      description: values.description,
      sections: sections.map((s, si) => ({ ...s, order: si, questions: s.questions.map((q, qi) => ({ ...q, order: qi })) })),
      aiGenerated,
      aiRationale: aiRationale || undefined,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(LIST);
      } else {
        const res = await createMutation.mutateAsync(payload);
        toast.success("สร้างแบบประเมินเรียบร้อย (ฉบับร่าง)");
        router.push(`/performance/templates/${res.data.id}/edit`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: isEdit ? "บันทึก" : "สร้างแบบประเมิน (ฉบับร่าง)", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ประเมินผล", href: "/performance" }, { label: "แบบประเมิน", href: LIST }, { label: isEdit ? "แก้ไขแบบประเมิน" : "สร้างแบบประเมิน" }]}
      backHref={isEdit ? LIST : LIST}
      title={isEdit ? "แก้ไขแบบประเมิน" : "สร้างแบบประเมิน"}
      description="กำหนดหมวดและข้อคำถามของแบบประเมิน — ตรวจสอบด้วยปุ่ม “ดูตัวอย่าง” ก่อนเปิดใช้งานจริง"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          {locked && (
            <Card className="border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              แบบประเมินนี้ไม่ใช่ฉบับร่างแล้ว จึงแก้ไขได้เฉพาะชื่อ/รายละเอียด — แก้ไขหมวดหรือข้อคำถามไม่ได้ เพื่อไม่ให้กระทบแคมเปญที่ใช้แบบประเมินนี้อยู่
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อแบบประเมิน</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น แบบประเมินพนักงาน" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รายละเอียด</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="เช่น แบบประเมินผลการปฏิบัติงานโดยหัวหน้างาน" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!locked && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">หมวดและข้อย่อย</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="size-4" /> ดูตัวอย่าง
                </Button>
                {!showAiDesigner && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAiDesigner(true)}>
                    <Sparkles className="size-4" /> ให้ AI ออกแบบให้
                  </Button>
                )}
              </div>
            </div>
          )}

          {locked && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="size-4" /> ดูตัวอย่าง
              </Button>
            </div>
          )}

          {aiGenerated && !locked && (
            <p className="text-xs text-primary">ออกแบบด้วย AI — สามารถแก้ไขหมวด/คำถามได้ตามต้องการก่อนบันทึก</p>
          )}

          {showAiDesigner && !locked && (
            <AiTemplateDesignerPanel onApply={handleAiApply} onClose={() => setShowAiDesigner(false)} />
          )}

          {locked ? (
            <div className="space-y-3">
              {sections.map((s, i) => (
                <Card key={i} className="p-4">
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.questions.length} ข้อย่อย</p>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((s, i) => (
                <SectionEditor
                  key={i}
                  section={s}
                  onChange={(section) => updateSection(i, section)}
                  onRemove={() => removeSection(i)}
                  onMoveUp={() => moveSection(i, -1)}
                  onMoveDown={() => moveSection(i, 1)}
                  canMoveUp={i > 0}
                  canMoveDown={i < sections.length - 1}
                />
              ))}
              <Button type="button" variant="outline" onClick={() => setSections([...sections, emptySection(sections.length)])}>
                <Plus className="size-4" /> เพิ่มหมวด
              </Button>
            </div>
          )}
        </form>
      </Form>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.watch("name") || "ตัวอย่างแบบประเมิน"}</DialogTitle>
          </DialogHeader>
          {form.watch("description") && <p className="text-sm text-muted-foreground">{form.watch("description")}</p>}
          <TemplateFormRenderer sections={toRendererSections(sections)} mode="preview" />
        </DialogContent>
      </Dialog>
    </FormPageShell>
  );
}
