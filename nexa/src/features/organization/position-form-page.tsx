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
import { JOB_LEVELS } from "./schema";
import { useDepartments, useCreatePosition, useUpdatePosition } from "./hooks";

const FORM_ID = "position-form";
const LIST = "/organization";
const NONE = "__none__";

const formSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อตำแหน่ง").max(120),
  code: z.string().trim().min(1, "กรุณาระบุรหัส").max(30),
  level: z.string(),
  departmentId: z.string(),
});
type FormSchema = z.infer<typeof formSchema>;

export type PositionInit = {
  id: string;
  title: string;
  code: string;
  level: number;
  departmentId: string | null;
};

export function PositionFormPage({ position }: { position?: PositionInit }) {
  const router = useRouter();
  const isEdit = !!position;
  const { data: deptData } = useDepartments();
  const departments = deptData?.data ?? [];
  const createMut = useCreatePosition();
  const updateMut = useUpdatePosition();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: position?.title ?? "",
      code: position?.code ?? "",
      level: String(position?.level ?? 1),
      departmentId: position?.departmentId ?? NONE,
    },
  });

  async function onSubmit(values: FormSchema) {
    const input = {
      title: values.title,
      code: values.code,
      level: values.level,
      departmentId: values.departmentId === NONE ? null : values.departmentId,
    };
    try {
      if (isEdit && position) {
        await updateMut.mutateAsync({ id: position.id, input });
        toast.success("บันทึกตำแหน่งแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(input);
        toast.success("สร้างตำแหน่งแล้ว");
        if (againRef.current) {
          form.reset({ title: "", code: "", level: "1", departmentId: NONE });
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
    { label: isEdit ? "บันทึก" : "เพิ่มตำแหน่ง", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "โครงสร้างองค์กร", href: LIST }, { label: isEdit ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง"}
      description="กำหนดชื่อตำแหน่ง ระดับ และฝ่ายที่สังกัด"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อตำแหน่ง *</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น ผู้จัดการฝ่ายขาย" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัส *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SALE-MGR"
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
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ระดับ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JOB_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={String(l.value)}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ฝ่ายที่สังกัด (ไม่บังคับ)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>— ไม่ระบุ —</SelectItem>
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
