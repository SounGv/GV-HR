"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
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
import { HourMinuteSelect } from "@/components/shared/time-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { computeHours, DAY_OFF_MULTIPLIER, DEFAULT_MULTIPLIER, dayOffReason } from "./calc";
import { cn } from "@/lib/utils";
import { useHolidays } from "@/features/holiday/hooks";
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

  const [date, start, end] = form.watch(["date", "startTime", "endTime"]);
  // Same rule the server applies when the request is sent (calc.ts dayOffReason). If this account cannot
  // read the holiday list, only Sundays show here; the server still counts company holidays.
  const year = Number(date.slice(0, 4));
  const holidays = useHolidays(year >= 2000 && year <= 2100 ? year : new Date().getFullYear());
  const dayOffWhy = dayOffReason(date, holidays.data?.data);
  const rate = dayOffWhy ? DAY_OFF_MULTIPLIER : DEFAULT_MULTIPLIER;
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
          {/* The system sets the day type from the date; the requester is told, not asked. */}
          {date && (
            <div className="space-y-1.5" aria-live="polite">
              <p
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold",
                  dayOffWhy ? "bg-accent text-foreground" : "bg-muted text-foreground",
                )}
              >
                <span>
                  {dayOffWhy ? "วันหยุด" : "วันทำงาน"}
                  {dayOffWhy && <span className="font-normal text-muted-foreground"> · {dayOffWhy}</span>}
                </span>
                <span className="tabular-nums">×{rate}</span>
              </p>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                ระบบกำหนดอัตราให้ตามวันที่ เสาร์ที่หยุดให้หัวหน้าปรับเป็นวันหยุดตอนอนุมัติ
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาเริ่ม</FormLabel>
                  <FormControl>
                    <HourMinuteSelect className="h-8 w-full min-w-0 rounded-lg border border-[color:var(--field-border)] bg-[var(--field-bg)] shadow-[var(--field-shadow)] px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm" minuteStep={5} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
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
                    <HourMinuteSelect className="h-8 w-full min-w-0 rounded-lg border border-[color:var(--field-border)] bg-[var(--field-bg)] shadow-[var(--field-shadow)] px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm" minuteStep={5} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
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
              รวม <span className="font-medium text-foreground">{hours}</span> ชั่วโมง (อัตรา {rate}×)
            </p>
          )}
        </form>
      </Form>
    </FormPageShell>
  );
}
