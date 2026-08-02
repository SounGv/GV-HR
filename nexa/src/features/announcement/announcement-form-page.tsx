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
import { useCreateAnnouncement, useUpdateAnnouncement } from "./hooks";
import type { Announcement } from "./types";

const FORM_ID = "ann-form";
const LIST = "/announcements";

const formSchema = z.object({
  title: z.string().trim().min(1, "กรุณากรอกหัวข้อ"),
  body: z.string().trim().min(1, "กรุณากรอกเนื้อหา"),
  pinned: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});
type FormSchema = z.infer<typeof formSchema>;

export function AnnouncementFormPage({ announcement }: { announcement?: Announcement }) {
  const router = useRouter();
  const isEdit = !!announcement;
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement(announcement?.id ?? "");
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: announcement?.title ?? "",
      body: announcement?.body ?? "",
      pinned: announcement?.pinned ?? false,
      status: announcement?.status ?? "PUBLISHED",
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        await updateMut.mutateAsync(values);
        toast.success("บันทึกประกาศเรียบร้อย");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values);
        toast.success("เผยแพร่ประกาศเรียบร้อย");
        if (againRef.current) {
          form.reset({ title: "", body: "", pinned: false, status: "PUBLISHED" });
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
    { label: isEdit ? "บันทึก" : "เผยแพร่", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ประกาศและแจ้งเตือน", href: LIST }, { label: isEdit ? "แก้ไข" : "สร้างใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขประกาศ" : "สร้างประกาศ"}
      description="เผยแพร่ข่าวสารและประกาศถึงพนักงานทั้งองค์กร"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หัวข้อ</FormLabel>
                <FormControl>
                  <Input placeholder="หัวข้อประกาศ" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="body"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เนื้อหา</FormLabel>
                <FormControl>
                  <Textarea rows={8} placeholder="รายละเอียดประกาศ" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
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
                      <SelectItem value="PUBLISHED">เผยแพร่</SelectItem>
                      <SelectItem value="DRAFT">ฉบับร่าง</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pinned"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>ปักหมุด</FormLabel>
                    <FormDescription>แสดงบนสุด</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </FormPageShell>
  );
}
