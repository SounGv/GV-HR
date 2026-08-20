"use client";

import { useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useCompetencyCategories } from "@/features/competency-category/hooks";
import { useCreateCompetency, useUpdateCompetency } from "./hooks";
import type { Competency } from "./types";

const FORM_ID = "competency-form";
const LIST = "/performance/competencies";
const NO_CATEGORY = "__none";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อสมรรถนะ"),
  description: z.string().optional(),
  exampleBehavior: z.string().optional(),
  categoryId: z.string(),
  active: z.boolean(),
});
type FormSchema = z.infer<typeof formSchema>;

export function CompetencyFormPage({ competency }: { competency?: Competency }) {
  const router = useRouter();
  const isEdit = !!competency;
  const createMutation = useCreateCompetency();
  const updateMutation = useUpdateCompetency(competency?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;
  const againRef = useRef(false);
  const { data: categoryData } = useCompetencyCategories();
  const categories = categoryData?.data ?? [];

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: competency?.name ?? "",
      description: competency?.description ?? "",
      exampleBehavior: competency?.exampleBehavior ?? "",
      categoryId: competency?.categoryId ?? NO_CATEGORY,
      active: competency?.active ?? true,
    },
  });

  async function onSubmit(values: FormSchema) {
    const payload = {
      ...values,
      categoryId: values.categoryId === NO_CATEGORY ? null : values.categoryId,
    };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(LIST);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("เพิ่มสมรรถนะเรียบร้อย");
        if (againRef.current) {
          form.reset({ name: "", description: "", exampleBehavior: "", categoryId: NO_CATEGORY, active: true });
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          router.push(LIST);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    ...(isEdit ? [] : [{ label: "บันทึกและเพิ่มใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "เพิ่มสมรรถนะ", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[
        { label: "ประเมินผล", href: "/performance" },
        { label: "เกณฑ์การประเมิน", href: LIST },
        { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" },
      ]}
      backHref={LIST}
      title={isEdit ? "แก้ไขหัวข้อประเมิน" : "เพิ่มหัวข้อประเมิน"}
      description="เกณฑ์การประเมินนี้ใช้ประกอบแคมเปญประเมินผล"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อสมรรถนะ</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น การทำงานเป็นทีม" {...field} />
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
                <FormLabel>คำอธิบาย</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="อธิบายพฤติกรรมที่คาดหวังสำหรับสมรรถนะนี้" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="exampleBehavior"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ตัวอย่างพฤติกรรม (ไม่บังคับ)</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="เช่น คิดหาทางแก้ปัญหาโดยไม่ต้องรอคำสั่ง" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมวดหมู่ (ไม่บังคับ)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="ไม่มีหมวดหมู่" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>ไม่มีหมวดหมู่</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  <Link href="/performance/competencies/categories/new" className="text-primary hover:underline">
                    + จัดการหมวดหมู่
                  </Link>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel>เปิดใช้งาน</FormLabel>
                  <FormDescription>ปิดไว้ถ้ายังไม่ต้องการให้เลือกใช้ในแคมเปญใหม่</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
