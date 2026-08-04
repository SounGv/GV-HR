"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { FormPageShell } from "@/components/shared/form-page-shell";
import type { FormFooterAction } from "@/components/shared/form-footer";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useDepartments } from "@/features/organization/hooks";
import { useCompetencies } from "@/features/competency/hooks";
import { groupByCategory } from "@/lib/competency-grouping";
import { useCreateScheduleTemplate, useUpdateScheduleTemplate } from "./hooks";
import type { RaterType, ScheduleTemplateDetail } from "./types";

const FORM_ID = "evaluation-schedule-form";
const LIST = "/performance/campaigns/schedules";

const RATER_TYPE_OPTIONS: { value: RaterType; label: string }[] = [
  { value: "SELF", label: "ตนเองประเมิน" },
  { value: "MANAGER", label: "หัวหน้างานประเมิน" },
];

const INTERVAL_OPTIONS = [
  { value: "1", label: "ทุกเดือน" },
  { value: "3", label: "ทุกไตรมาส (3 เดือน)" },
  { value: "6", label: "ทุกครึ่งปี (6 เดือน)" },
  { value: "12", label: "ทุกปี (12 เดือน)" },
];

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อรอบอัตโนมัติ"),
  departmentId: z.string().min(1, "กรุณาเลือกแผนก"),
  intervalMonths: z.string().min(1),
  durationDays: z.string().min(1),
  nextRunAt: z.string().min(1, "กรุณาเลือกวันที่เริ่มรอบแรก"),
  active: z.boolean(),
});
type FormSchema = z.infer<typeof formSchema>;

export function ScheduleTemplateFormPage({ template }: { template?: ScheduleTemplateDetail }) {
  const router = useRouter();
  const isEdit = !!template;
  const { data: deptData } = useDepartments();
  const departments = deptData?.data ?? [];
  const { data: competencyData } = useCompetencies();
  const competencies = competencyData?.data ?? [];
  const groupedCompetencies = groupByCategory(competencies);

  const [selected, setSelected] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    template?.competencies.forEach((c) => {
      initial[c.competencyId] = c.weight;
    });
    return initial;
  });
  const [raterTypes, setRaterTypes] = useState<RaterType[]>(template?.raterTypes ?? ["SELF", "MANAGER"]);

  function toggleRaterType(type: RaterType) {
    setRaterTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

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

  const createMutation = useCreateScheduleTemplate();
  const updateMutation = useUpdateScheduleTemplate(template?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name ?? "",
      departmentId: template?.department.id ?? "",
      intervalMonths: String(template?.intervalMonths ?? 1),
      durationDays: String(template?.durationDays ?? 14),
      nextRunAt: template?.nextRunAt?.slice(0, 10) ?? "",
      active: template?.active ?? true,
    },
  });

  async function onSubmit(values: FormSchema) {
    const competencyList = Object.entries(selected).map(([competencyId, weight]) => ({ competencyId, weight }));
    if (competencyList.length === 0) {
      toast.error("กรุณาเลือกสมรรถนะอย่างน้อย 1 รายการ");
      return;
    }
    if (raterTypes.length === 0) {
      toast.error("กรุณาเลือกทิศทางการประเมินอย่างน้อย 1 แบบ");
      return;
    }
    const payload = {
      name: values.name,
      departmentId: values.departmentId,
      intervalMonths: Number(values.intervalMonths),
      durationDays: Number(values.durationDays) || 14,
      nextRunAt: values.nextRunAt,
      active: values.active,
      raterTypes,
      competencies: competencyList,
    };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("สร้างรอบอัตโนมัติเรียบร้อย");
      }
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: isEdit ? "บันทึก" : "สร้างรอบอัตโนมัติ", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "ประเมินผล", href: "/performance" },
        { label: "รอบอัตโนมัติ", href: LIST },
        { label: isEdit ? "แก้ไข" : "สร้างใหม่" },
      ]}
      backHref={LIST}
      title={isEdit ? "แก้ไขรอบอัตโนมัติ" : "สร้างรอบประเมินอัตโนมัติ"}
      description="ระบบจะสร้างแคมเปญประเมินผลใหม่ให้อัตโนมัติตามรอบที่กำหนด (เริ่มต้นเป็นฉบับร่างเสมอ ให้ HR ตรวจสอบก่อนเปิดใช้งาน)"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อรอบอัตโนมัติ</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น ประเมินรายเดือน - ฝ่ายขาย" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>แผนก</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="เลือกแผนก" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
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
              name="intervalMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ความถี่</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INTERVAL_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
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
              name="nextRunAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เริ่มรอบแรกวันที่</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ระยะเวลาเปิดรับผลประเมิน (วัน)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={90} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Card className="gap-2 p-4">
            <p className="text-sm font-medium text-foreground">ทิศทางการประเมิน</p>
            <div className="flex flex-wrap gap-3">
              {RATER_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={raterTypes.includes(opt.value)}
                    onChange={() => toggleRaterType(opt.value)}
                    className="size-4 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Card>

          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel>เปิดใช้งาน</FormLabel>
                  <FormDescription>ปิดไว้เพื่อหยุดสร้างแคมเปญใหม่ชั่วคราว โดยไม่ต้องลบรอบนี้</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <Card className="gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">สมรรถนะที่ใช้ประเมิน</p>
              <span className="text-xs text-muted-foreground">เลือกแล้ว {Object.keys(selected).length} รายการ</span>
            </div>
            {competencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีสมรรถนะในคลัง —{" "}
                <Link href="/performance/competencies/new" className="text-primary hover:underline">
                  เพิ่มสมรรถนะก่อน
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {groupedCompetencies.map((group) => (
                  <div key={group.categoryId} className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">{group.categoryName}</p>
                    {group.items.map((c) => {
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
                ))}
              </div>
            )}
          </Card>
        </form>
      </Form>
    </FormPageShell>
  );
}
