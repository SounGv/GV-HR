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
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useCreateTemplate, useUpdateTemplate } from "./hooks";
import type { ShiftTemplate, TemplateFormValues } from "./types";

const FORM_ID = "template-form";
const LIST = "/shifts";

const formSchema = z.object({
  name: z.string().min(1, "กรุณาระบุชื่อกะ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง"),
  breakMinutes: z.string().regex(/^\d+$/, "ตัวเลขเท่านั้น"),
});
type FormSchema = z.infer<typeof formSchema>;

export function TemplateFormPage({ template }: { template?: ShiftTemplate }) {
  const router = useRouter();
  const isEdit = !!template;
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: template
      ? {
          name: template.name,
          startTime: template.startTime,
          endTime: template.endTime,
          color: template.color,
          breakMinutes: String(template.breakMinutes),
        }
      : { name: "", startTime: "08:00", endTime: "17:00", color: "#2563EB", breakMinutes: "60" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && template) {
        await updateMut.mutateAsync({ id: template.id, input: values as Partial<TemplateFormValues> });
        toast.success("บันทึกกะแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values as TemplateFormValues);
        toast.success("สร้างกะแล้ว");
        if (againRef.current) {
          form.reset();
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
    ...(isEdit ? [] : [{ label: "บันทึกและสร้างใหม่", onClick: () => (againRef.current = true) }]),
    { label: isEdit ? "บันทึก" : "สร้างกะ", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "กะการทำงาน", href: LIST }, { label: isEdit ? "แก้ไขกะ" : "สร้างกะ" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขกะ" : "สร้างกะการทำงาน"}
      description="กำหนดชื่อ ช่วงเวลา และสีของกะ"
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
                <FormLabel>ชื่อกะ</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น กะเช้า" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาเริ่ม</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาสิ้นสุด</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สี</FormLabel>
                  <FormControl>
                    <Input type="color" className="h-9 p-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="breakMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>พักเบรก (นาที)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </FormPageShell>
  );
}
