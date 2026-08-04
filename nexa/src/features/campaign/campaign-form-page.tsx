"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { useCompetencies } from "@/features/competency/hooks";
import { AiDesignerPanel } from "./ai-designer-panel";
import { useCreateCampaign, useUpdateCampaign } from "./hooks";
import type { CampaignDetail } from "./types";

const FORM_ID = "campaign-form";
const LIST = "/performance";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อแคมเปญ"),
  cycle: z.string().trim().min(1, "กรุณาระบุรอบการประเมิน"),
  startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
  endDate: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุด"),
});
type FormSchema = z.infer<typeof formSchema>;

function defaultCycle() {
  const d = new Date();
  const half = d.getMonth() < 6 ? 1 : 2;
  return `H${half}/${d.getFullYear() + 543}`;
}

export function CampaignFormPage({ campaign }: { campaign?: CampaignDetail }) {
  const router = useRouter();
  const isEdit = !!campaign;
  const { data: competencyData } = useCompetencies();
  const competencies = competencyData?.data ?? [];

  const [selected, setSelected] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    campaign?.competencies.forEach((c) => {
      initial[c.competencyId] = c.weight;
    });
    return initial;
  });
  const [aiGenerated, setAiGenerated] = useState(campaign?.aiGenerated ?? false);
  const [aiRationale, setAiRationale] = useState(campaign?.aiRationale ?? "");
  const [showAiDesigner, setShowAiDesigner] = useState(false);

  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign(campaign?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      cycle: campaign?.cycle ?? defaultCycle(),
      startDate: campaign?.startDate?.slice(0, 10) ?? "",
      endDate: campaign?.endDate?.slice(0, 10) ?? "",
    },
  });

  function toggle(competencyId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (competencyId in next) delete next[competencyId];
      else next[competencyId] = 3;
      return next;
    });
  }

  function setWeight(competencyId: string, weight: number) {
    setSelected((prev) => ({ ...prev, [competencyId]: weight }));
  }

  function handleAiApply(items: { competencyId: string; weight: number }[], rationale: string) {
    setSelected((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.competencyId] = item.weight;
      });
      return next;
    });
    setAiGenerated(true);
    setAiRationale(rationale);
    setShowAiDesigner(false);
  }

  async function onSubmit(values: FormSchema) {
    const competencyList = Object.entries(selected).map(([competencyId, weight]) => ({ competencyId, weight }));
    if (competencyList.length === 0) {
      toast.error("กรุณาเลือกสมรรถนะอย่างน้อย 1 รายการ");
      return;
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ ...values, competencies: competencyList });
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(`/performance/campaigns/${campaign.id}`);
      } else {
        const res = await createMutation.mutateAsync({
          ...values,
          competencies: competencyList,
          aiGenerated,
          aiRationale: aiRationale || undefined,
        });
        toast.success("สร้างแคมเปญเรียบร้อย");
        router.push(`/performance/campaigns/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: isEdit ? "บันทึก" : "สร้างแคมเปญ", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ประเมินผล", href: LIST }, { label: isEdit ? "แก้ไขแคมเปญ" : "สร้างแคมเปญ" }]}
      backHref={isEdit ? `/performance/campaigns/${campaign.id}` : LIST}
      title={isEdit ? "แก้ไขแคมเปญ" : "สร้างแคมเปญประเมินผล"}
      description="กำหนดสมรรถนะและน้ำหนักคะแนนสำหรับรอบการประเมินนี้"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>ชื่อแคมเปญ</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น ประเมินผลงาน H1/2569" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cycle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รอบการประเมิน</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น H1/2569" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่เริ่ม</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่สิ้นสุด</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {showAiDesigner && (
            <AiDesignerPanel onApply={handleAiApply} onClose={() => setShowAiDesigner(false)} />
          )}

          <Card className="gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">สมรรถนะที่ใช้ประเมิน</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">เลือกแล้ว {Object.keys(selected).length} รายการ</span>
                {!showAiDesigner && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAiDesigner(true)}>
                    <Sparkles className="size-4" /> ให้ AI ออกแบบให้
                  </Button>
                )}
              </div>
            </div>
            {aiGenerated && (
              <p className="flex items-center gap-1 text-xs text-primary">ออกแบบด้วย AI — สามารถปรับน้ำหนักหรือเพิ่ม/ลดรายการได้ตามต้องการ</p>
            )}
            {competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีสมรรถนะในคลัง —{" "}
                <Link href="/performance/competencies/new" className="text-primary hover:underline">
                  เพิ่มสมรรถนะก่อน
                </Link>
              </p>
            ) : (
              <div className="space-y-1.5">
                {competencies.map((c) => {
                  const checked = c.id in selected;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        className="size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.name}</span>
                      {checked && (
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={selected[c.id]}
                          onChange={(e) => setWeight(c.id, Number(e.target.value) || 1)}
                          className="w-16 shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </form>
      </Form>
    </FormPageShell>
  );
}
