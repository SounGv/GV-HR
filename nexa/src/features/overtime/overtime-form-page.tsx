"use client";

import { useEffect, useRef, useState } from "react";
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
    dayType: z.enum(["NORMAL", "DAY_OFF"]),
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
    defaultValues: { date: "", dayType: "NORMAL", startTime: "18:00", endTime: "20:00", reason: "" },
  });

  const [date, start, end, dayType] = form.watch(["date", "startTime", "endTime", "dayType"]);
  const rate = dayType === "DAY_OFF" ? DAY_OFF_MULTIPLIER : DEFAULT_MULTIPLIER;
  const hours = start && end && end > start ? computeHours(start, end) : 0;

  // The day type follows the date: a Sunday or a company holiday switches to
  // the day-off rate by itself. The employee can still change it, which is how
  // an off Saturday is chosen until the system knows who is off which Saturday.
  const year = Number(date.slice(0, 4));
  const holidays = useHolidays(year >= 2000 && year <= 2100 ? year : new Date().getFullYear());
  const autoReason = dayOffReason(date, holidays.data?.data);
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoReason) {
      form.setValue("dayType", "DAY_OFF");
      setAutoSelected(true);
    } else if (autoSelected) {
      form.setValue("dayType", "NORMAL");
      setAutoSelected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReason]);

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
          <FormField
            control={form.control}
            name="dayType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ประเภทวัน</FormLabel>
                <div role="radiogroup" aria-label="ประเภทวัน" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(
                    [
                      ["NORMAL", "วันทำงาน", DEFAULT_MULTIPLIER],
                      ["DAY_OFF", "วันหยุด", DAY_OFF_MULTIPLIER],
                    ] as const
                  ).map(([value, title, times]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={field.value === value}
                      onClick={() => {
                        field.onChange(value);
                        setAutoSelected(false);
                      }}
                      className={cn(
                        "min-h-11 rounded-lg px-3 text-sm font-semibold transition",
                        field.value === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {title} <span className="tabular-nums">×{times}</span>
                    </button>
                  ))}
                </div>
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {autoReason && field.value === "DAY_OFF"
                    ? `ระบบเลือกให้ เพราะ${autoReason} (เปลี่ยนได้)`
                    : "เสาร์ที่หยุดหรือวันหยุดพิเศษ ให้เลือก “วันหยุด” เอง"}
                </p>
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
              รวม <span className="font-medium text-foreground">{hours}</span> ชั่วโมง (อัตรา {rate}×) · ยอดเงินจะคำนวณให้เมื่อหัวหน้าอนุมัติ
            </p>
          )}
        </form>
      </Form>
    </FormPageShell>
  );
}
