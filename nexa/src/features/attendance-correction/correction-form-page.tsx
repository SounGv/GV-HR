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
import { useCreateAttendanceCorrection } from "./hooks";

const FORM_ID = "attendance-correction-form";
const LIST = "/attendance/corrections";
const timeRe = /^\d{2}:\d{2}$/;

const formSchema = z
  .object({
    workDate: z.string().min(1, "กรุณาเลือกวันที่"),
    requestedClockIn: z.string().optional(),
    requestedClockOut: z.string().optional(),
    reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
  })
  .refine((d) => !!d.requestedClockIn || !!d.requestedClockOut, {
    message: "กรุณาระบุเวลาเข้าหรือออกที่ต้องการแก้ไขอย่างน้อยหนึ่งอย่าง",
    path: ["requestedClockIn"],
  })
  .refine((d) => !d.requestedClockIn || timeRe.test(d.requestedClockIn), {
    message: "เวลาไม่ถูกต้อง",
    path: ["requestedClockIn"],
  })
  .refine((d) => !d.requestedClockOut || timeRe.test(d.requestedClockOut), {
    message: "เวลาไม่ถูกต้อง",
    path: ["requestedClockOut"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function CorrectionFormPage() {
  const router = useRouter();
  const createMut = useCreateAttendanceCorrection();
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { workDate: "", requestedClockIn: "", requestedClockOut: "", reason: "" },
  });

  async function onSubmit(values: FormSchema) {
    try {
      await createMut.mutateAsync(values);
      toast.success("ส่งคำขอแก้ไขเวลาเรียบร้อย");
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
      breadcrumbs={[{ label: "แก้ไขเวลาเข้า-ออกงาน", href: LIST }, { label: "ส่งคำขอใหม่" }]}
      backHref={LIST}
      title="แก้ไขเวลาเข้า-ออกงาน"
      description="ระบุวันที่และเวลาที่ถูกต้องเพื่อส่งให้หัวหน้างานอนุมัติ"
      formId={FORM_ID}
      pending={createMut.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <FormField
            control={form.control}
            name="workDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>วันที่ต้องการแก้ไข</FormLabel>
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
              name="requestedClockIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาเข้า (ที่ถูกต้อง)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requestedClockOut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาออก (ที่ถูกต้อง)</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ระบุเฉพาะเวลาที่ต้องการแก้ไข — เว้นว่างช่องที่ไม่ต้องการเปลี่ยน
          </p>
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เหตุผล</FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="เช่น ลืมเช็คอิน / ระบบขัดข้องตอนสแกน" {...field} />
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
