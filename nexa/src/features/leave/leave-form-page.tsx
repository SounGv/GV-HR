"use client";

import { useEffect, useRef } from "react";
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
import { FileAttachField } from "@/components/shared/file-attach-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { MobileLeaveForm } from "@/components/mobile/mobile-leave-form";
import { DesktopOnly } from "@/components/mobile/mobile-screen";
import { LEAVE_TYPES, LEAVE_UNITS } from "./schema";
import { computeLeaveDays, computeLeaveHours, HOURLY_LEAVE_TYPES } from "./days";
import { LEAVE_TYPE_LABEL } from "./labels";
import { useCreateLeave } from "./hooks";
import { BalanceCards } from "./balance-cards";

const FORM_ID = "leave-form";
const LIST = "/leave";

function isHourlyType(type: string): boolean {
  return (HOURLY_LEAVE_TYPES as readonly string[]).includes(type);
}

const formSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().min(1, "กรุณาเลือกวันเริ่ม"),
    endDate: z.string().min(1, "กรุณาเลือกวันสิ้นสุด"),
    halfDay: z.boolean(),
    unit: z.enum(LEAVE_UNITS),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    reason: z.string().optional(),
    attachmentUrl: z.string().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม",
    path: ["endDate"],
  })
  .refine((d) => !d.halfDay || d.startDate === d.endDate, {
    message: "ลาครึ่งวันต้องเป็นวันเดียว",
    path: ["halfDay"],
  })
  .refine((d) => d.unit !== "HOUR" || !!(d.startTime && d.endTime), {
    message: "กรุณาระบุเวลาเริ่ม-สิ้นสุด",
    path: ["startTime"],
  })
  .refine((d) => d.unit !== "HOUR" || !d.startTime || !d.endTime || d.endTime > d.startTime, {
    message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม",
    path: ["endTime"],
  });
type FormSchema = z.infer<typeof formSchema>;

export function LeaveFormPage() {
  const router = useRouter();
  const createMutation = useCreateLeave();
  const againRef = useRef(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "ANNUAL",
      startDate: "",
      endDate: "",
      halfDay: false,
      unit: "DAY",
      startTime: "",
      endTime: "",
      reason: "",
      attachmentUrl: "",
    },
  });

  const [leaveType, start, end, half, unit, startTime, endTime] = form.watch([
    "type",
    "startDate",
    "endDate",
    "halfDay",
    "unit",
    "startTime",
    "endTime",
  ]);
  const showHourlyOption = isHourlyType(leaveType);
  const isHourly = showHourlyOption && unit === "HOUR";
  const preview = isHourly
    ? startTime && endTime && endTime > startTime
      ? computeLeaveHours(startTime, endTime)
      : null
    : start && end && end >= start
      ? computeLeaveDays(new Date(start), new Date(end), half)
      : null;

  useEffect(() => {
    if (!showHourlyOption && unit === "HOUR") form.setValue("unit", "DAY");
  }, [showHourlyOption, unit, form]);

  useEffect(() => {
    if (isHourly && start) form.setValue("endDate", start);
  }, [isHourly, start, form]);

  async function onSubmit(values: FormSchema) {
    try {
      await createMutation.mutateAsync(values);
      toast.success("ส่งคำขอลาเรียบร้อย");
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
    <>
      <MobileLeaveForm />
      <DesktopOnly>
    <FormPageShell
      breadcrumbs={[{ label: "การลา", href: LIST }, { label: "ขอลาใหม่" }]}
      backHref={LIST}
      title="ขอลา"
      description="กรอกรายละเอียดการลาเพื่อส่งให้หัวหน้างานอนุมัติ"
      formId={FORM_ID}
      pending={createMutation.isPending}
      onCancel={() => router.push(LIST)}
      actions={actions}
    >
      <div className="mb-6">
        <BalanceCards />
      </div>
      <Form {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ประเภทการลา</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LEAVE_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {showHourlyOption && (
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รูปแบบการลา</FormLabel>
                  <div className="flex gap-2">
                    {LEAVE_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => field.onChange(u)}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                          field.value === u
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {u === "DAY" ? "เต็มวัน / ครึ่งวัน" : "เป็นชั่วโมง"}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )}
            />
          )}

          {isHourly ? (
            <>
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันที่ลา</FormLabel>
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
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>วันเริ่ม</FormLabel>
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
                      <FormLabel>วันสิ้นสุด</FormLabel>
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
                name="halfDay"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>ลาครึ่งวัน</FormLabel>
                      <FormDescription>นับเป็น 0.5 วัน (เฉพาะวันเดียว)</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เหตุผล</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="ระบุเหตุผลการลา (ถ้ามี)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="attachmentUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>แนบไฟล์ประกอบ (ถ้ามี)</FormLabel>
                <FormControl>
                  <FileAttachField value={field.value} onChange={field.onChange} label="แนบใบรับรองแพทย์" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {preview !== null && (
            <p className="text-sm text-muted-foreground">
              รวมทั้งหมด <span className="font-medium text-foreground">{preview}</span> {isHourly ? "ชั่วโมง" : "วัน"}
            </p>
          )}
        </form>
      </Form>
    </FormPageShell>
      </DesktopOnly>
    </>
  );
}
