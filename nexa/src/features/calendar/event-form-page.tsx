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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useCreateEvent, useUpdateEvent } from "./hooks";
import { EVENT_TYPES } from "./schema";
import type { EventFormValues, EventType } from "./types";

const FORM_ID = "event-form";
const LIST = "/calendar";

const TYPE_LABEL: Record<EventType, string> = {
  event: "กิจกรรม",
  meeting: "ประชุม",
  deadline: "กำหนดส่ง",
};

const formSchema = z
  .object({
    title: z.string().min(1, "กรุณาระบุชื่อกิจกรรม"),
    description: z.string().optional(),
    type: z.enum(EVENT_TYPES),
    startDate: z.string().min(1, "กรุณาเลือกวันที่เริ่ม"),
    endDate: z.string().optional(),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  });
type FormSchema = z.infer<typeof formSchema>;

export type EventInit = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startDate: string;
  endDate: string | null;
};

export function EventFormPage({ event, defaultDate }: { event?: EventInit; defaultDate?: string }) {
  const router = useRouter();
  const isEdit = !!event;
  const createMut = useCreateEvent();
  const updateMut = useUpdateEvent();
  const pending = createMut.isPending || updateMut.isPending;
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: event
      ? {
          title: event.title,
          description: event.description ?? "",
          type: (EVENT_TYPES as readonly string[]).includes(event.type)
            ? (event.type as EventType)
            : "event",
          startDate: event.startDate,
          endDate: event.endDate ?? "",
        }
      : { title: "", description: "", type: "event", startDate: defaultDate ?? "", endDate: "" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      if (isEdit && event) {
        await updateMut.mutateAsync({ id: event.id, input: values as Partial<EventFormValues> });
        toast.success("บันทึกกิจกรรมแล้ว");
        router.push(LIST);
      } else {
        await createMut.mutateAsync(values as EventFormValues);
        toast.success("เพิ่มกิจกรรมแล้ว");
        if (againRef.current) {
          form.reset({ title: "", description: "", type: "event", startDate: values.startDate, endDate: "" });
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
    { label: isEdit ? "บันทึก" : "เพิ่มกิจกรรม", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ปฏิทินองค์กร", href: LIST }, { label: isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม" }]}
      backHref={LIST}
      title={isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
      description="กิจกรรมองค์กรจะปรากฏในปฏิทินรวม"
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
                <FormLabel>ชื่อกิจกรรม</FormLabel>
                <FormControl>
                  <Input placeholder="เช่น ประชุมประจำเดือน" {...field} />
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
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่เริ่ม</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ถึงวันที่ (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รายละเอียด</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FormPageShell>
  );
}
