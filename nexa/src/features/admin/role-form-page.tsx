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
import { useCreateRole } from "./hooks";

const FORM_ID = "role-form";
const LIST_HREF = "/admin";

const formSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อบทบาท").max(100),
  description: z.string().trim().max(300).optional(),
});
type FormSchema = z.infer<typeof formSchema>;

export function RoleFormPage() {
  const router = useRouter();
  const createMut = useCreateRole();

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      const res = await createMut.mutateAsync({ ...values, permissions: [] });
      toast.success("สร้างบทบาทเรียบร้อย — เลือกสิทธิ์ในหน้าผู้ดูแลระบบ");
      router.push(`${LIST_HREF}?role=${res.data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [{ label: "สร้างบทบาท", primary: true }];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ผู้ดูแลระบบ", href: LIST_HREF }, { label: "สร้างบทบาท" }]}
      backHref={LIST_HREF}
      title="สร้างบทบาทใหม่"
      description="ตั้งชื่อบทบาท แล้วเลือกสิทธิ์การเข้าถึงในหน้าถัดไป"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST_HREF)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อบทบาท</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น หัวหน้าคลังสินค้า" {...field} />
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
                <FormLabel>คำอธิบาย (ไม่บังคับ)</FormLabel>
                <FormControl>
                  <Input placeholder="คำอธิบายสั้น ๆ เกี่ยวกับบทบาทนี้" {...field} />
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
