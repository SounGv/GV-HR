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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useCreateCompetencyCategory, useUpdateCompetencyCategory } from "./hooks";
import type { CompetencyCategory } from "./types";

const FORM_ID = "competency-category-form";
const LIST = "/performance/competencies";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อหมวดหมู่"),
  order: z.string(),
});
type FormSchema = z.infer<typeof formSchema>;

export function CompetencyCategoryFormPage({ category }: { category?: CompetencyCategory }) {
  const router = useRouter();
  const isEdit = !!category;
  const createMutation = useCreateCompetencyCategory();
  const updateMutation = useUpdateCompetencyCategory(category?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      order: String(category?.order ?? 0),
    },
  });

  async function onSubmit(values: FormSchema) {
    const payload = { name: values.name, order: Number(values.order) || 0 };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("เพิ่มหมวดหมู่เรียบร้อย");
      }
      router.push(LIST);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: isEdit ? "บันทึก" : "เพิ่มหมวดหมู่", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "ประเมินผล", href: "/performance" },
        { label: "คลังสมรรถนะ", href: LIST },
        { label: isEdit ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่" },
      ]}
      backHref={LIST}
      title={isEdit ? "แก้ไขหมวดหมู่สมรรถนะ" : "เพิ่มหมวดหมู่สมรรถนะ"}
      description="หมวดหมู่ใช้จัดกลุ่มสมรรถนะที่เกี่ยวข้องกัน เช่น Owner mindset, Teamwork"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อหมวดหมู่</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น Owner mindset" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ลำดับการแสดงผล</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
