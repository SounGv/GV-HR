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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { HOLIDAY_TYPES } from "./schema";
import { useCreateHoliday, useUpdateHoliday } from "./hooks";
import type { Holiday } from "./types";

const FORM_ID = "holiday-form";
const LIST = "/holidays";
const TYPE_LABEL: Record<string, string> = { COMPANY: "วันหยุดบริษัท", NATIONAL: "วันหยุดราชการ" };

const formSchema = z.object({
  date: z.string().min(1, "กรุณาเลือกวันที่"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อวันหยุด"),
  type: z.enum(HOLIDAY_TYPES),
  notifyEnabled: z.boolean(),
});
type FormSchema = z.infer<typeof formSchema>;

export function HolidayFormPage({ holiday }: { holiday?: Holiday }) {
  const router = useRouter();
  const isEdit = !!holiday;
  const createMutation = useCreateHoliday();
  const updateMutation = useUpdateHoliday(holiday?.id ?? "");
  const pending = createMutation.isPending || updateMutation.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: holiday?.date ? holiday.date.slice(0, 10) : "",
      name: holiday?.name ?? "",
      type: holiday?.type ?? "COMPANY",
      notifyEnabled: holiday?.notifyEnabled ?? true,
    },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
        router.push(LIST);
      } else {
        await createMutation.mutateAsync(values);
        toast.success("เพิ่มวันหยุดเรียบร้อย");
        if (againRef.current) {
          form.reset({ date: "", name: "", type: "COMPANY", notifyEnabled: true });
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
    { label: isEdit ? "บันทึก" : "เพิ่มวันหยุด", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "วันหยุด", href: LIST }, { label: isEdit ? "แก้ไข" : "เพิ่มใหม่" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}
      description="กำหนดวันหยุดสำหรับปฏิทินองค์กร"
      formId={FORM_ID}
      pending={pending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>วันที่</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
                <FormLabel>ชื่อวันหยุด</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น วันสงกรานต์" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ประเภท</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HOLIDAY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notifyEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <FormLabel>แจ้งเตือนล่วงหน้า</FormLabel>
                  <FormDescription>ส่งการแจ้งเตือนก่อนถึงวันหยุด</FormDescription>
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
