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
import { computeHours } from "./calc";
import { useCreateOvertime } from "./hooks";

const FORM_ID = "ot-form";
const LIST = "/overtime";

const formSchema = z
  .object({
    date: z.string().min(1, "กรุณาเลือกวันที่"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง"),
    reason: z.string().optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endTime"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function OvertimeFormPage() {
  const router = useRouter();
  const createMut = useCreateOvertime();
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { date: "", startTime: "18:00", endTime: "20:00", reason: "" },
  });

  const [start, end] = form.watch(["startTime", "endTime"]);
  const hours = start && end && end > start ? computeHours(start, end) : 0;

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values);
      toast.success("ส่งคำขอ OT เรียบร้อย");
      if (againRef.current) {
        form.reset();
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        router.push(LIST);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  const actions: FormFooterAction[] = [
    { label: "ส่งและเพิ่มใหม่", onClick: () => (againRef.current = true) },
    { label: "ส่งคำขอ", onClick: () => (againRef.current = false), primary: true },
  ];

  return (
    <FormPageShell
      breadcrumbs={[{ label: "ล่วงเวลา (OT)", href: LIST }, { label: "ขอ OT ใหม่" }]}
      backHref={LIST}
      title="ขอทำงานล่วงเวลา (OT)"
      description="ระบุวันและช่วงเวลาเพื่อส่งให้หัวหน้างานอนุมัติ"
      formId={FORM_ID}
      pending={createMut.isPending}
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
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เหตุผล</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="ระบุงานที่ต้องทำล่วงเวลา" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          {hours > 0 && (
            <p className="text-sm text-muted-foreground">
              รวม <span className="font-medium text-foreground">{hours}</span> ชั่วโมง (อัตรา 1.5×)
            </p>
          )}
        </form>
      </Form>
    </FormPageShell>
  );
}
