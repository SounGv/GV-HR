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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { useDepartments, useCreateDepartment, useUpdateDepartment } from "./hooks";

const FORM_ID = "department-form";
const LIST = "/organization";
const NONE = "__none__";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120),
  code: z.string().trim().min(1, "กรุณาระบุรหัส").max(30),
  parentId: z.string(),
});
type FormSchema = z.infer<typeof formSchema>;

export type DepartmentInit = { id: string; name: string; code: string; parentId: string | null };

export function DepartmentFormPage({ department }: { department?: DepartmentInit }) {
  const router = useRouter();
  const isEdit = !!department;
  const { data: deptData } = useDepartments();
  const departments = (deptData?.data ?? []).filter((d) => d.id !== department?.id);
  const createMut = useCreateDepartment();
  const updateMut = useUpdateDepartment();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: department?.name ?? "",
      code: department?.code ?? "",
      parentId: department?.parentId ?? NONE,
    },
  });

  async function onSubmit(values: FormSchema) {
    const input = { name: values.name, code: values.code, parentId: values.parentId === NONE ? null : values.parentId };
    try {
      if (isEdit && department) {
        await updateMut.mutateAsync({ id: department.id, input });
        toast.success("บันทึกฝ่ายแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(input);
        toast.success("สร้างฝ่ายแล้ว");
        if (againRef.current) {
          form.reset({ name: "", code: "", parentId: NONE });
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
    { label: isEdit ? "บันทึก" : "เพิ่มฝ่าย", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "โครงสร้างองค์กร", href: LIST }, { label: isEdit ? "แก้ไขฝ่าย/แผนก" : "เพิ่มฝ่าย/แผนก" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขฝ่าย/แผนก" : "เพิ่มฝ่าย/แผนก"}
      description="เลือก “ฝ่ายแม่” เพื่อทำเป็นแผนกย่อย"
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
                <FormLabel>ชื่อฝ่าย/แผนก *</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น แผนกบัญชี" {...field} />
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
                <FormLabel>รหัส *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="เช่น ACC"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ฝ่ายแม่ (ไม่บังคับ)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>— ไม่มี (เป็นฝ่ายหลัก) —</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
