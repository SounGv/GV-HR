"use client";

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
import { ApiError } from "@/lib/api/client";
import { useUpdateGoalProgress } from "./hooks";
import type { Goal } from "./types";

const FORM_ID = "goal-progress-form";

const formSchema = z.object({
  currentValue: z.string().regex(/^\d+(\.\d+)?$/, "กรุณากรอกตัวเลข"),
});
type FormSchema = z.infer<typeof formSchema>;

export function GoalProgressFormPage({ goal }: { goal: Goal }) {
  const router = useRouter();
  const listHref = `/kpi/${goal.id}`;
  const mut = useUpdateGoalProgress();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentValue: String(goal.currentValue) },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await mut.mutateAsync({ id: goal.id, currentValue: values.currentValue });
      toast.success("อัปเดตความคืบหน้าแล้ว");
      router.push(listHref);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "อัปเดตไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "บันทึก", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "KPI", href: "/kpi" },
        { label: goal.title, href: listHref },
        { label: "อัปเดตความคืบหน้า" },
      ]}
      backHref={listHref}
      title="อัปเดตความคืบหน้า"
      description={goal.title}
      formId={FORM_ID}
      pending={mut.isPending}
      onCancel={() => router.push(listHref)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-sm space-y-4">
          <FormField
            control={form.control}
            name="currentValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ค่าปัจจุบัน</FormLabel>
                <FormControl>
                  <Input type="number" step="any" autoFocus {...field} />
                </FormControl>
                <FormDescription>
                  เป้าหมาย {goal.targetValue} {goal.unit}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
