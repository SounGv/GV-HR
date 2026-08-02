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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useCreateCostCenter, useUpdateCostCenter } from "./hooks";

const FORM_ID = "cost-center-form";
const LIST = "/cost-centers";

const formSchema = z.object({
  code: z.string().trim().min(1, "กรุณากรอกรหัส").max(30),
  name: z.string().trim().min(1, "กรุณากรอกชื่อศูนย์ต้นทุน").max(120),
  description: z.string().max(300).optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export type CostCenterInit = { id: string; code: string; name: string; description: string | null };

export function CostCenterFormPage({ item }: { item?: CostCenterInit }) {
  const router = useRouter();
  const isEdit = !!item;
  const createMut = useCreateCostCenter();
  const updateMut = useUpdateCostCenter();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: item?.code ?? "",
      name: item?.name ?? "",
      description: item?.description ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && item) {
        await updateMut.mutateAsync({ id: item.id, input: values });
        toast.success("บันทึกแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values);
        toast.success("เพิ่มศูนย์ต้นทุนแล้ว");
        if (againRef.current) {
          form.reset({ code: "", name: "", description: "" });
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
    { label: isEdit ? "บันทึก" : "เพิ่มศูนย์ต้นทุน", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ศูนย์ต้นทุน", href: LIST }, { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขศูนย์ต้นทุน" : "เพิ่มศูนย์ต้นทุน"}
      description="จัดกลุ่มงบประมาณของพนักงานตามศูนย์ต้นทุน"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัส *</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น CC-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อศูนย์ต้นทุน *</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
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
