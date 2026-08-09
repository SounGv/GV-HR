"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useCompetencies } from "@/features/competency/hooks";
import { COMPETENCIES, SCORE_RUBRIC, computeOverall, scoreBand } from "./calc";
import { useCreateReview, useUpdateReview } from "./hooks";

const FORM_ID = "review-form";
const LIST = "/performance";

function defaultCycle() {
  const d = new Date();
  const half = d.getMonth() < 6 ? 1 : 2;
  return `H${half}/${d.getFullYear() + 543}`;
}

const formSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  cycle: z.string().min(1, "กรุณาระบุรอบการประเมิน"),
  competencies: z.array(z.object({ name: z.string(), score: z.number().min(1, "1–5").max(5, "1–5") })),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  summary: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export type ReviewInit = {
  id: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  cycle: string;
  competencies: { name: string; score: number }[];
  strengths: string | null;
  improvements: string | null;
  summary: string | null;
};

export function ReviewFormPage({ review }: { review?: ReviewInit }) {
  const router = useRouter();
  const isEdit = !!review;
  const { data: orgData } = useOrgOptions();
  const { data: compData, isLoading: compsLoading } = useCompetencies();
  const createMut = useCreateReview();
  const updateMut = useUpdateReview(review?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;

  // Configured competencies (HR-managed) take priority; the fixed list is
  // only a fallback for orgs that haven't set any up yet.
  const configured = compData?.data ?? [];
  const competencyDisplay =
    configured.length > 0
      ? configured.map((c) => ({ name: c.name, category: c.category?.name ?? null }))
      : COMPETENCIES.map((name) => ({ name, category: null as string | null }));

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: review
      ? {
          employeeId: review.employee.id,
          cycle: review.cycle,
          competencies: COMPETENCIES.map((name) => ({
            name,
            score: review.competencies.find((c) => c.name === name)?.score ?? 3,
          })),
          strengths: review.strengths ?? "",
          improvements: review.improvements ?? "",
          summary: review.summary ?? "",
        }
      : {
          employeeId: "",
          cycle: defaultCycle(),
          competencies: COMPETENCIES.map((name) => ({ name, score: 3 })),
          strengths: "",
          improvements: "",
          summary: "",
        },
  });

  // Once the real (HR-configured) competency list loads, rebuild the
  // competencies field to match it — carrying over any already-saved score
  // by name. Only happens once so it never clobbers in-progress edits.
  const rebuiltRef = useRef(false);
  useEffect(() => {
    if (rebuiltRef.current || compsLoading || configured.length === 0) return;
    rebuiltRef.current = true;
    const savedByName = new Map((review?.competencies ?? []).map((c) => [c.name, c.score]));
    form.setValue(
      "competencies",
      configured.map((c) => ({ name: c.name, score: savedByName.get(c.name) ?? 3 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compsLoading, configured]);

  const comps = form.watch("competencies");
  const overall = computeOverall(comps ?? []);
  const [showRubric, setShowRubric] = useState(false);

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        const { employeeId: _drop, ...rest } = values;
        void _drop;
        await updateMut.mutateAsync(rest);
        toast.success("บันทึกการประเมินเรียบร้อย");
      } else {
        await createMut.mutateAsync(values);
        toast.success("สร้างการประเมินเรียบร้อย");
      }
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: isEdit ? "บันทึก" : "สร้างการประเมิน", primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ประเมินผล", href: LIST }, { label: isEdit ? "แก้ไขการประเมิน" : "สร้างการประเมิน" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขการประเมิน" : "สร้างการประเมินผลงาน"}
      description="ให้คะแนนสมรรถนะ 1–5 ระบบจะคำนวณคะแนนรวมและเกรดให้อัตโนมัติ"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>พนักงาน</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="เลือกพนักงาน">
                          {(value) => {
                            const m = (orgData?.data.managers ?? []).find((x) => x.id === value);
                            return m
                              ? `${m.firstName} ${m.lastName} (${m.employeeCode})`
                              : "เลือกพนักงาน";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(orgData?.data.managers ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.firstName} {m.lastName} ({m.employeeCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">สมรรถนะ (1–5)</span>
                <button
                  type="button"
                  onClick={() => setShowRubric((v) => !v)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Info className="size-3.5" /> เกณฑ์ให้คะแนน
                </button>
              </div>
              <span className="text-sm text-muted-foreground">
                รวม <span className="font-semibold text-foreground">{overall.toFixed(1)}</span> ·{" "}
                {scoreBand(overall)}
              </span>
            </div>

            {showRubric && (
              <div className="grid gap-1.5 rounded-md bg-muted/50 p-2.5 text-xs">
                {SCORE_RUBRIC.map((r) => (
                  <div key={r.score} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right font-semibold text-foreground">{r.score}</span>
                    <span className="w-32 shrink-0 font-medium text-foreground">{r.label}</span>
                    <span className="text-muted-foreground">{r.desc}</span>
                  </div>
                ))}
              </div>
            )}

            {competencyDisplay.map((c, i) => {
              const prevCategory = i > 0 ? competencyDisplay[i - 1].category : undefined;
              return (
                <div key={`${c.name}-${i}`}>
                  {c.category && c.category !== prevCategory && (
                    <p className="mb-1 mt-3 text-xs font-semibold text-muted-foreground first:mt-0">
                      {c.category}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{c.name}</span>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      step={0.5}
                      className="w-20"
                      {...form.register(`competencies.${i}.score`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
              );
            })}

            {!compsLoading && configured.length === 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                ยังไม่มีหัวข้อสมรรถนะที่ตั้งค่าไว้ ใช้หัวข้อเริ่มต้นอยู่ —{" "}
                <Link href="/performance/competencies/new" className="text-primary hover:underline">
                  ตั้งค่าหัวข้อของบริษัทเอง
                </Link>
              </p>
            )}
          </div>

          <FormField
            control={form.control}
            name="strengths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จุดแข็ง</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="improvements"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สิ่งที่ควรพัฒนา</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สรุปผลการประเมิน</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
