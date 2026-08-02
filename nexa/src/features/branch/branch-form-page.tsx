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
import { useCreateBranch, useUpdateBranch } from "./hooks";

const FORM_ID = "branch-form";
const LIST = "/branches";

// Plain form schema (the API schema preprocesses empty→null server-side).
const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อสาขา").max(120),
  code: z.string().trim().min(1, "กรุณากรอกรหัสสาขา").max(30),
  address: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export type BranchInit = { id: string; name: string; code: string; address: string | null; phone: string | null };

export function BranchFormPage({ branch }: { branch?: BranchInit }) {
  const router = useRouter();
  const isEdit = !!branch;
  const createMut = useCreateBranch();
  const updateMut = useUpdateBranch();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: branch?.name ?? "",
      code: branch?.code ?? "",
      address: branch?.address ?? "",
      phone: branch?.phone ?? "",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && branch) {
        await updateMut.mutateAsync({ id: branch.id, input: values });
        toast.success("บันทึกสาขาแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values);
        toast.success("เพิ่มสาขาแล้ว");
        if (againRef.current) {
          form.reset({ name: "", code: "", address: "", phone: "" });
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
    { label: isEdit ? "บันทึก" : "เพิ่มสาขา", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "สาขา", href: LIST }, { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขสาขา" : "เพิ่มสาขา"}
      description="ข้อมูลสาขาและสำนักงานขององค์กร"
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
                <FormLabel>ชื่อสาขา *</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น สำนักงานใหญ่" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสสาขา *</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น HQ" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ที่อยู่</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>โทรศัพท์</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
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
