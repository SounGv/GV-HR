"use client";

import { useRef } from "react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useOrgOptions } from "@/features/employee/hooks";
import { useCreateGoal, useUpdateGoal } from "./hooks";
import { GOAL_TYPES, GOAL_STATUSES } from "./schema";
import { GOAL_STATUS_LABEL } from "./labels";
import type { Goal, GoalFormValues } from "./types";

const FORM_ID = "goal-form";
const LIST = "/kpi";

const formSchema = z.object({
  employeeId: z.string().uuid("กรุณาเลือกพนักงาน"),
  parentGoalId: z.string().uuid().optional(),
  title: z.string().min(1, "กรุณาระบุชื่อเป้าหมาย"),
  description: z.string().optional(),
  type: z.enum(GOAL_TYPES),
  cycle: z.string().min(1, "กรุณาระบุรอบ"),
  unit: z.string().min(1, "ระบุหน่วย"),
  targetValue: z.string().regex(/^\d+(\.\d+)?$/, "ตัวเลขเท่านั้น"),
  currentValue: z.string().regex(/^\d+(\.\d+)?$/, "ตัวเลขเท่านั้น"),
  weight: z.string().regex(/^[1-5]$/, "1-5"),
  status: z.enum(GOAL_STATUSES),
  dueDate: z.string().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

interface ParentGoal {
  id: string;
  title: string;
  cycle: string;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
}

export function GoalFormPage({ goal, parentGoal }: { goal?: Goal; parentGoal?: ParentGoal }) {
  const router = useRouter();
  const isEdit = !!goal;
  const isKeyResult = !!parentGoal;
  const { data: orgData } = useOrgOptions();
  const employees = orgData?.data.managers ?? [];
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);
  const backHref = parentGoal ? `/kpi/${parentGoal.id}` : LIST;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: goal
      ? {
          employeeId: goal.employee.id,
          title: goal.title,
          description: goal.description ?? "",
          type: goal.type,
          cycle: goal.cycle,
          unit: goal.unit,
          targetValue: String(goal.targetValue),
          currentValue: String(goal.currentValue),
          weight: String(goal.weight),
          status: goal.status,
          dueDate: goal.dueDate ? goal.dueDate.slice(0, 10) : "",
        }
      : {
          employeeId: parentGoal?.employee.id ?? "",
          parentGoalId: parentGoal?.id,
          title: "",
          description: "",
          type: "KPI",
          cycle: parentGoal?.cycle ?? "",
          unit: "%",
          targetValue: "100",
          currentValue: "0",
          weight: "1",
          status: "NOT_STARTED",
          dueDate: "",
        },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && goal) {
        const { employeeId: _drop, parentGoalId: _drop2, ...rest } = values;
        void _drop;
        void _drop2;
        await updateMut.mutateAsync({ id: goal.id, input: rest as Partial<GoalFormValues> });
        toast.success("บันทึกเป้าหมายแล้ว");
        router.push(LIST);
      } else {
        const record = await createMut.mutateAsync(values as GoalFormValues);
        toast.success(isKeyResult ? "เพิ่ม Key Result แล้ว" : "สร้างเป้าหมายแล้ว");
        if (isKeyResult && parentGoal) {
          router.push(`/kpi/${parentGoal.id}`);
        } else if (againRef.current) {
          form.reset();
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push(`/kpi/${record.data.id}`);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    ...(isEdit || isKeyResult ? [] : [{ label: "บันทึกและสร้างใหม่", onClick: () => (againRef.current = true) }]),
    {
      label: isEdit ? "บันทึก" : isKeyResult ? "เพิ่ม Key Result" : "สร้างเป้าหมาย",
      onClick: () => (againRef.current = false),
      primary: true,
    },
  ];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "KPI & Level", href: LIST },
        ...(parentGoal ? [{ label: parentGoal.title, href: `/kpi/${parentGoal.id}` }] : []),
        { label: isEdit ? "แก้ไขเป้าหมาย" : isKeyResult ? "เพิ่ม Key Result" : "สร้างเป้าหมาย" },
      ]}
      backHref={backHref}
      title={isEdit ? "แก้ไขเป้าหมาย" : isKeyResult ? "เพิ่ม Key Result" : "สร้างเป้าหมาย / KPI"}
      description={
        isKeyResult
          ? `ตัวชี้วัดย่อยของ Objective "${parentGoal!.title}" — ความคืบหน้าของทุก Key Result จะรวมเป็นความคืบหน้าของ Objective`
          : "กำหนดเป้าหมายที่วัดผลได้ พร้อมค่าเป้าหมายและหน่วยวัด"
      }
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(backHref)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          {isKeyResult ? (
            <div className="rounded-lg border border-primary/30 bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
              สำหรับ <b>{parentGoal!.employee.firstName} {parentGoal!.employee.lastName}</b> · Objective:{" "}
              <b>{parentGoal!.title}</b> · รอบ {parentGoal!.cycle}
            </div>
          ) : (
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
                          <SelectValue placeholder="เลือกพนักงาน" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((m) => (
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ประเภท</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GOAL_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isKeyResult ? "ชื่อ Key Result" : "ชื่อเป้าหมาย"}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={isKeyResult ? "เช่น NPS เพิ่มเป็น 60 คะแนน" : "เช่น ปิดการขาย 20 ดีลต่อไตรมาส"}
                    {...field}
                  />
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
                  <Textarea rows={2} placeholder="อธิบายเป้าหมายและวิธีวัดผล" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="cycle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รอบ</FormLabel>
                  <FormControl>
                    <Input placeholder="H1/2569" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หน่วย</FormLabel>
                  <FormControl>
                    <Input placeholder="%" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>น้ำหนัก (1-5)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เป้าหมาย</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ปัจจุบัน</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานะ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GOAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {GOAL_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>กำหนดส่ง (ไม่บังคับ)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
