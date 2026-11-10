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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/shared/time-select";
import { Textarea } from "@/components/ui/textarea";
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
import { LEAVE_TYPES, LEAVE_UNITS, HALF_DAY_PERIODS } from "./schema";
import { addHoursToTime, computeLeaveDays, computeLeaveHours, HOURLY_LEAVE_TYPES, isSunday } from "./days";
import { LEAVE_TYPE_LABEL, HALF_DAY_PERIOD_LABEL } from "./labels";
import { useCreateLeave } from "./hooks";
import { BalanceCards } from "./balance-cards";

const FORM_ID = "leave-form";
const LIST = "/leave";

/** Same presets as the mobile form's single "ระยะเวลาลา" picker — see its comment. */
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_HOUR_START = "09:00";

function isHourlyType(type: string): boolean {
  return (HOURLY_LEAVE_TYPES as readonly string[]).includes(type);
}

const formSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.string().min(1, "กรุณาเลือกวันเริ่ม"),
    endDate: z.string().min(1, "กรุณาเลือกวันสิ้นสุด"),
    halfDay: z.boolean(),
    halfDayPeriod: z.enum(HALF_DAY_PERIODS).optional(),
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
  .refine((d) => !d.halfDay || !!d.halfDayPeriod, {
    message: "กรุณาเลือกช่วงเวลาลาครึ่งวัน",
    path: ["halfDayPeriod"],
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
      halfDayPeriod: undefined,
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
  const halfDayPeriod = form.watch("halfDayPeriod");
  const showHourlyOption = isHourlyType(leaveType);
  const isHourly = showHourlyOption && unit === "HOUR";
  const preview = isHourly
    ? startTime && endTime && endTime > startTime
      ? computeLeaveHours(startTime, endTime)
      : null
    : start && end && end >= start
      ? computeLeaveDays(new Date(start), new Date(end), half)
      : null;

  // One "ระยะเวลาลา" select standing in for what used to be three separate
  // controls (DAY/HOUR toggle, half-day switch, morning/afternoon picker) —
  // its value is derived from the real form fields, not tracked separately,
  // so there is exactly one source of truth (same pattern as the mobile form).
  const durationValue = isHourly
    ? startTime && endTime && endTime > startTime
      ? `HOUR_${Math.round(computeLeaveHours(startTime, endTime))}`
      : ""
    : half
      ? halfDayPeriod === "AFTERNOON"
        ? "HALF_AFTERNOON"
        : halfDayPeriod === "MORNING"
          ? "HALF_MORNING"
          : ""
      : "FULL_DAY";

  function onDurationChange(value: string | null) {
    if (!value) return;
    if (value === "FULL_DAY") {
      form.setValue("unit", "DAY");
      form.setValue("halfDay", false, { shouldValidate: true });
      form.setValue("halfDayPeriod", undefined);
    } else if (value === "HALF_MORNING" || value === "HALF_AFTERNOON") {
      form.setValue("unit", "DAY");
      form.setValue("halfDay", true);
      form.setValue("halfDayPeriod", value === "HALF_MORNING" ? "MORNING" : "AFTERNOON", { shouldValidate: true });
      const sd = form.getValues("startDate");
      if (sd) form.setValue("endDate", sd);
    } else if (value.startsWith("HOUR_")) {
      const hours = Number(value.slice(5));
      form.setValue("unit", "HOUR");
      form.setValue("halfDay", false);
      form.setValue("halfDayPeriod", undefined);
      const sd = form.getValues("startDate");
      if (sd) form.setValue("endDate", sd);
      const st = form.getValues("startTime") || DEFAULT_HOUR_START;
      form.setValue("startTime", st);
      form.setValue("endTime", addHoursToTime(st, hours), { shouldValidate: true });
    }
  }

  useEffect(() => {
    // Hourly leave isn't offered for this type anymore — fall back to a full
    // day rather than leaving an hour-unit selection the picker can't show.
    if (!showHourlyOption && unit === "HOUR") onDurationChange("FULL_DAY");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHourlyOption, unit]);

  useEffect(() => {
    if (durationValue !== "FULL_DAY" && start) form.setValue("endDate", start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationValue, start]);

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

          <FormItem>
            <FormLabel>ระยะเวลาลา</FormLabel>
            <Select value={durationValue} onValueChange={onDurationChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="เลือกระยะเวลา" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="FULL_DAY">เต็มวัน</SelectItem>
                <SelectItem value="HALF_MORNING">ครึ่งวัน (ช่วงเช้า)</SelectItem>
                <SelectItem value="HALF_AFTERNOON">ครึ่งวัน (ช่วงบ่าย)</SelectItem>
                {showHourlyOption &&
                  HOUR_OPTIONS.map((n) => (
                    <SelectItem key={n} value={`HOUR_${n}`}>
                      ลา {n} ชั่วโมง
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormItem>

          {durationValue === "FULL_DAY" ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วันเริ่ม</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          const next = e.target.value;
                          const currentEnd = form.getValues("endDate");
                          if (!currentEnd || currentEnd < next) form.setValue("endDate", next);
                        }}
                      />
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
          ) : (
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
          )}

          {isHourly && (
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เวลาเริ่ม (สิ้นสุด {endTime || "—"} น.)</FormLabel>
                  <FormControl>
                    <TimeSelect
                      className="h-8 w-full min-w-0 rounded-lg border border-[color:var(--field-border)] bg-[var(--field-bg)] shadow-[var(--field-shadow)] px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                      {...field}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const hours = startTime && endTime ? computeLeaveHours(startTime, endTime) : 1;
                        field.onChange(e);
                        form.setValue("endTime", addHoursToTime(newStart, hours), { shouldValidate: true });
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

          {(isHourly ? !!start && isSunday(new Date(start)) : preview === 0) ? (
            <p role="alert" className="text-sm text-destructive">
              วันที่เลือกเป็นวันอาทิตย์ ซึ่งไม่ใช่วันทำงาน (นับวันลาจันทร์–เสาร์) กรุณาเลือกวันอื่น
            </p>
          ) : half ? (
            <p className="text-sm text-muted-foreground">
              รวมทั้งหมด{" "}
              <span className="font-medium text-foreground">
                ครึ่งวัน{halfDayPeriod ? ` (${HALF_DAY_PERIOD_LABEL[halfDayPeriod]})` : ""}
              </span>
            </p>
          ) : (
            preview !== null && (
              <p className="text-sm text-muted-foreground">
                รวมทั้งหมด <span className="font-medium text-foreground">{preview}</span> {isHourly ? "ชั่วโมง" : "วัน (นับจันทร์–เสาร์ ไม่นับวันอาทิตย์)"}
              </p>
            )
          )}
        </form>
      </Form>
    </FormPageShell>
      </DesktopOnly>
    </>
  );
}
