"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api/client";
import { addParticipants as addParticipantsApi, updateCampaign as updateCampaignApi } from "@/features/campaign/api";
import { useCreateCampaign } from "@/features/campaign/hooks";
import type { RaterType } from "@/features/campaign/types";
import { updateTemplate as updateTemplateApi } from "@/features/evaluation-template/api";
import { useCreateEvaluationTemplate, useEvaluationTemplate } from "@/features/evaluation-template/hooks";
import { PeopleStep } from "./people-step";
import { AiReviewStep, PreviewStep, QuestionsStep, TemplateSelectStep, emptyTemplateDraft, type TemplateDraft } from "./template-steps";

const RATER_OPTIONS: { value: RaterType; label: string; hint: string }[] = [
  { value: "SELF", label: "ตนเองประเมิน", hint: "พนักงานประเมินตนเอง" },
  { value: "MANAGER", label: "หัวหน้างานประเมิน", hint: "ประเมินอัตโนมัติตามสายบังคับบัญชา" },
  { value: "PEER", label: "เพื่อนร่วมงานประเมิน (Peer)", hint: "เชิญเพิ่มทีหลังเป็นรายบุคคล" },
  { value: "UPWARD", label: "ผู้ใต้บังคับบัญชาประเมิน (Upward)", hint: "สร้างงานให้ลูกทีมอัตโนมัติตามสายบังคับบัญชา" },
  { value: "HR_EXEC", label: "HR / ผู้บริหารประเมิน", hint: "เชิญเพิ่มทีหลังเป็นรายบุคคล" },
];

const STEP_LABEL: Record<string, string> = {
  basics: "ข้อมูลรอบ",
  people: "เลือกคน/ทีม/ฝ่าย",
  raters: "เลือกผู้ประเมิน",
  template: "เลือกแบบประเมิน",
  questions: "แก้ไขหัวข้อ",
  ai: "AI ช่วยตรวจ",
  preview: "ดูตัวอย่าง",
  publish: "เผยแพร่",
};

interface Basics {
  name: string;
  cycle: string;
  startDate: string;
  endDate: string;
}

export function CampaignWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [basics, setBasics] = useState<Basics>({ name: "", cycle: "", startDate: "", endDate: "" });
  const [raterTypes, setRaterTypes] = useState<RaterType[]>(["SELF", "MANAGER"]);
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<TemplateDraft>(emptyTemplateDraft());
  const [publishing, setPublishing] = useState(false);

  const createCampaign = useCreateCampaign();
  const createTemplate = useCreateEvaluationTemplate();
  const { data: existingTemplateData } = useEvaluationTemplate(draft.mode === "existing" ? draft.templateId ?? undefined : undefined);

  // Skip the build/AI-review steps entirely when reusing an already-ACTIVE
  // template — its structure is locked, editing it here would be pointless.
  const steps = useMemo(
    () => (draft.mode === "existing" ? ["basics", "people", "raters", "template", "preview", "publish"] : ["basics", "people", "raters", "template", "questions", "ai", "preview", "publish"]),
    [draft.mode],
  );
  const step = steps[stepIndex] ?? steps[steps.length - 1];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function canAdvance(): boolean {
    switch (step) {
      case "basics":
        return !!(basics.name.trim() && basics.cycle.trim() && basics.startDate && basics.endDate);
      case "people":
        return participantIds.size > 0;
      case "raters":
        return raterTypes.length > 0;
      case "template":
        return draft.mode === "existing" ? !!draft.templateId : !!draft.name.trim();
      case "questions":
        return draft.sections.length > 0 && draft.sections.every((s) => s.name.trim() && s.questions.length > 0);
      default:
        return true;
    }
  }

  function next() {
    if (!canAdvance()) {
      toast.error("กรุณากรอกข้อมูลในขั้นตอนนี้ให้ครบก่อน");
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    if (isFirst) {
      router.push("/performance");
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function publish() {
    setPublishing(true);
    try {
      let templateId = draft.templateId;
      if (draft.mode === "new") {
        const created = await createTemplate.mutateAsync({
          name: draft.name,
          description: draft.description || undefined,
          sections: draft.sections.map((s, si) => ({ ...s, order: si, questions: s.questions.map((q, qi) => ({ ...q, order: qi })) })),
          aiGenerated: draft.aiGenerated,
          aiRationale: draft.aiRationale || undefined,
        });
        templateId = created.data.id;
        // Activate right after creating — a fresh DRAFT template can't be
        // referenced by a campaign yet (see getTemplateSnapshot).
        await updateTemplateApi(templateId, { status: "ACTIVE" });
      }

      const campaignRes = await createCampaign.mutateAsync({
        name: basics.name,
        cycle: basics.cycle,
        startDate: basics.startDate,
        endDate: basics.endDate,
        raterTypes,
        templateId: templateId!,
      });
      const campaignId = campaignRes.data.id;

      await addParticipantsApi(campaignId, Array.from(participantIds));
      // New campaigns start DRAFT — flip to ACTIVE last, once every
      // participant/response row already exists, so updateCampaign's
      // DRAFT→ACTIVE transition notifies every rater in one pass.
      await updateCampaignApi(campaignId, { status: "ACTIVE" });

      toast.success("สร้างรอบประเมินเรียบร้อยแล้ว");
      router.push(`/performance/campaigns/${campaignId}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างรอบประเมินไม่สำเร็จ");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมินผล", href: "/performance" }, { label: "สร้างรอบประเมิน" }]}
        backHref="/performance"
        title="สร้างรอบประเมิน"
        description={`ขั้นตอนที่ ${stepIndex + 1} จาก ${steps.length} · ${STEP_LABEL[step]}`}
      />

      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s}
            className={
              "rounded-full px-2.5 py-1 text-xs font-medium " +
              (i === stepIndex ? "bg-primary text-primary-foreground" : i < stepIndex ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")
            }
          >
            {i + 1}. {STEP_LABEL[s]}
          </span>
        ))}
      </div>

      <Card className="max-w-3xl p-5">
        {step === "basics" && (
          <div className="grid grid-cols-1 gap-3 sm:max-w-md">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">ชื่อรอบประเมิน</span>
              <Input placeholder="เช่น ประเมินผลงาน H2/2569" value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">รอบ/ปี</span>
              <Input placeholder="เช่น H2/2569" value={basics.cycle} onChange={(e) => setBasics({ ...basics, cycle: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">วันที่เริ่ม</span>
                <Input type="date" value={basics.startDate} onChange={(e) => setBasics({ ...basics, startDate: e.target.value })} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">วันที่สิ้นสุด</span>
                <Input type="date" value={basics.endDate} onChange={(e) => setBasics({ ...basics, endDate: e.target.value })} />
              </label>
            </div>
          </div>
        )}

        {step === "people" && <PeopleStep selectedIds={participantIds} onChange={setParticipantIds} />}

        {step === "raters" && (
          <div className="space-y-2.5">
            {RATER_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                <Checkbox
                  checked={raterTypes.includes(opt.value)}
                  onCheckedChange={(v) =>
                    setRaterTypes(v ? [...raterTypes, opt.value] : raterTypes.filter((r) => r !== opt.value))
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === "template" && <TemplateSelectStep draft={draft} onChange={setDraft} />}
        {step === "questions" && <QuestionsStep draft={draft} onChange={setDraft} />}
        {step === "ai" && <AiReviewStep draft={draft} onChange={setDraft} />}
        {step === "preview" && (
          <PreviewStep draft={draft} existingSections={draft.mode === "existing" ? existingTemplateData?.data.sections ?? null : null} />
        )}

        {step === "publish" && (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              พร้อมเผยแพร่รอบ <b>{basics.name}</b> ({basics.cycle}) ให้ผู้เข้าร่วม <b>{participantIds.size} คน</b> ด้วยแบบประเมิน{" "}
              <b>{draft.mode === "existing" ? existingTemplateData?.data.name : draft.name}</b>
            </p>
            <p className="text-sm text-muted-foreground">
              ทิศทางการประเมิน: {raterTypes.map((r) => RATER_OPTIONS.find((o) => o.value === r)?.label).join(", ")}
            </p>
            <Button size="lg" onClick={publish} disabled={publishing}>
              {publishing && <Loader2 className="size-4 animate-spin" />} เผยแพร่รอบประเมิน
            </Button>
          </div>
        )}
      </Card>

      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between border-t border-border bg-card px-4 py-3 md:-mx-6 md:bg-background/85 md:px-6 md:backdrop-blur-xl">
        <Button variant="ghost" onClick={back}>
          <ChevronLeft className="size-4" /> {isFirst ? "ยกเลิก" : "ย้อนกลับ"}
        </Button>
        {!isLast && (
          <Button onClick={next}>
            ถัดไป <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
