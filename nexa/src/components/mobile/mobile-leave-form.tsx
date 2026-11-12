"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { FileAttachField } from "@/components/shared/file-attach-field";
import { TimeSelect } from "@/components/shared/time-select";
import { LEAVE_TYPES, LEAVE_UNITS, HALF_DAY_PERIODS } from "@/features/leave/schema";
import { addHoursToTime, computeLeaveDays, computeLeaveHours, canTakeHourly, isSunday } from "@/features/leave/days";
import { remainingLeaveHours } from "@/features/leave/hour-pool";
import { LEAVE_TYPE_LABEL, HALF_DAY_PERIOD_LABEL } from "@/features/leave/labels";
import { useBalances, useCreateLeave } from "@/features/leave/hooks";
import type { LeaveType } from "@/features/leave/types";
import { MobileActionFooter, MobilePrimaryButton } from "./mobile-action-footer";
import { MobileAlertBanner, MobileSuccessCard } from "./mobile-alert-banner";
import { MobileScreen } from "./mobile-screen";

const FORM_ID = "mobile-leave-form";
const LIST = "/leave";


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
  })
  // The same two rules the server checks (features/leave/schema.ts), so the form says so before sending.
  .refine((d) => d.unit !== "HOUR" || d.startDate === d.endDate, {
    message: "ลาเป็นชั่วโมงต้องเป็นวันเดียว",
    path: ["endDate"],
  })
  .refine(
    (d) => d.unit !== "HOUR" || !d.startTime || !d.endTime || d.endTime <= d.startTime || computeLeaveHours(d.startTime, d.endTime) >= 1,
    { message: "ลาเป็นชั่วโมงได้อย่างน้อย 1 ชั่วโมง", path: ["endTime"] },
  );

type FormSchema = z.infer<typeof formSchema>;

const TYPE_ORDER: LeaveType[] = ["SICK", "PERSONAL", "ANNUAL", "UNPAID", "HOLIDAY_SWAP", "OTHER"];
const UNLIMITED_TYPES: LeaveType[] = ["UNPAID", "HOLIDAY_SWAP", "OTHER"];

/** Whole-hour presets offered by the single "ระยะเวลาลา" picker — anything
 * approaching a full 8-hour day stops making sense as "hourly" leave. */
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_HOUR_START = "09:00";

function fmtThaiDate(iso: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function MobileLeaveForm() {
  const router = useRouter();
  const createMutation = useCreateLeave();
  const { data: balanceData } = useBalances();
  const [submitted, setSubmitted] = useState(false);
  const [lastRequest, setLastRequest] = useState<FormSchema | null>(null);
  const [routedTo, setRoutedTo] = useState<string | null>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "SICK",
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

  const [type, start, end, half, halfDayPeriod, unit, startTime, endTime] = form.watch([
    "type",
    "startDate",
    "endDate",
    "halfDay",
    "halfDayPeriod",
    "unit",
    "startTime",
    "endTime",
  ]);
  const showHourlyOption = canTakeHourly(type);
  const isHourly = showHourlyOption && unit === "HOUR";

  // One "ระยะเวลาลา" picker standing in for what used to be three separate
  // controls (DAY/HOUR toggle, half-day checkbox, morning/afternoon picker) —
  // its value is derived from the real form fields rather than tracked
  // separately, so there is exactly one source of truth.
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

  function onDurationChange(value: string) {
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

  const preview = isHourly
    ? startTime && endTime && endTime > startTime
      ? computeLeaveHours(startTime, endTime)
      : null
    : start && end && end >= start
      ? computeLeaveDays(new Date(start), new Date(end), half)
      : null;

  const balanceMap = useMemo(() => {
    const map = new Map<
      LeaveType,
      { remaining: number; total: number; remainingHours: number; totalHours: number; configured: boolean }
    >();
    for (const b of balanceData?.data ?? []) {
      map.set(b.type, {
        remaining: Math.max(0, b.totalDays - b.usedDays),
        total: b.totalDays,
        remainingHours: remainingLeaveHours(b),
        totalHours: b.totalHours,
        configured: b.daysConfigured,
      });
    }
    return map;
  }, [balanceData]);

  const blockedMessage = useMemo(() => {
    // Monday to Saturday is the working week: a request that only covers a Sunday cannot be sent.
    if (isHourly ? !!start && isSunday(new Date(start)) : preview === 0) {
      return <>วันที่เลือกเป็นวันอาทิตย์ ซึ่งไม่ใช่วันทำงาน (นับวันลาจันทร์–เสาร์) กรุณาเลือกวันอื่น</>;
    }
    if (!preview || UNLIMITED_TYPES.includes(type) || type === "OTHER") return null;
    const bal = balanceMap.get(type);
    if (!bal) return null;
    if (isHourly) {
      if (preview > bal.remainingHours) {
        return bal.configured ? (
          <>
            ชั่วโมง{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ <b>{bal.remainingHours} ชม.</b> แต่ขอลา{" "}
            <b>{preview} ชม.</b> กรุณาเลือกเวลาใหม่
          </>
        ) : (
          <>ชั่วโมง{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — กรุณาติดต่อ HR หรือเปลี่ยนเป็นลาไม่รับค่าจ้าง</>
        );
      }
      return null;
    }
    if (preview > bal.remaining) {
      return bal.configured ? (
        <>
          วัน{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ <b>{bal.remaining} วัน</b> แต่ขอลา{" "}
          <b>{preview} วัน</b> กรุณาเลือกวันใหม่ หรือเปลี่ยนเป็นลาไม่รับค่าจ้าง
        </>
      ) : (
        <>วัน{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — กรุณาติดต่อ HR หรือเปลี่ยนเป็นลาไม่รับค่าจ้าง</>
      );
    }
    return null;
  }, [preview, type, balanceMap, isHourly, start]);

  /** Tells the person what is missing instead of the button silently doing nothing. */
  function onInvalid(errors: Partial<Record<keyof FormSchema, { message?: string }>>) {
    const first = Object.values(errors).find((e) => e?.message);
    toast.error(first?.message ?? "กรุณากรอกข้อมูลให้ครบ");
  }

  const blockedIsSunday = isHourly ? !!start && isSunday(new Date(start)) : preview === 0;

  async function onSubmit(values: FormSchema) {
    if (blockedMessage) return;
    try {
      const res = await createMutation.mutateAsync(values);
      setRoutedTo(res.data.routedTo ?? null);
      setLastRequest(values);
      setSubmitted(true);
      toast.success("ส่งคำขอลาเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  if (submitted && lastRequest) {
    const wasHourly = lastRequest.unit === "HOUR";
    const days =
      !wasHourly && lastRequest.startDate && lastRequest.endDate
        ? computeLeaveDays(new Date(lastRequest.startDate), new Date(lastRequest.endDate), lastRequest.halfDay)
        : null;
    const hours =
      wasHourly && lastRequest.startTime && lastRequest.endTime
        ? computeLeaveHours(lastRequest.startTime, lastRequest.endTime)
        : null;

    return (
      <MobileScreen title="ขอลา" backHref={LIST} contentClassName="p-4">
        <MobileSuccessCard
          title="ส่งคำขอลาสำเร็จ"
          subtitle="รอหัวหน้างานอนุมัติ"
          rows={[
            { label: "ประเภท", value: LEAVE_TYPE_LABEL[lastRequest.type] },
            {
              label: wasHourly ? "วันที่/เวลา" : "วันที่",
              value: wasHourly
                ? `${fmtThaiDate(lastRequest.startDate)} (${lastRequest.startTime}–${lastRequest.endTime})`
                : lastRequest.startDate === lastRequest.endDate
                  ? fmtThaiDate(lastRequest.startDate)
                  : `${fmtThaiDate(lastRequest.startDate)} – ${fmtThaiDate(lastRequest.endDate)}`,
            },
            {
              label: wasHourly ? "จำนวนชั่วโมง" : "จำนวนวัน",
              value: wasHourly
                ? hours != null
                  ? `${hours} ชม.`
                  : "—"
                : lastRequest.halfDay
                  ? `ครึ่งวัน${lastRequest.halfDayPeriod ? ` (${HALF_DAY_PERIOD_LABEL[lastRequest.halfDayPeriod]})` : ""}`
                  : days != null
                    ? `${days} วัน`
                    : "—",
            },
            ...(routedTo ? [{ label: "ส่งถึง", value: routedTo }] : []),
            { label: "สถานะ", value: "รออนุมัติ", highlight: true },
          ]}
          action={
            <MobilePrimaryButton onClick={() => router.push("/dashboard")}>
              กลับหน้าหลัก
            </MobilePrimaryButton>
          }
        />
      </MobileScreen>
    );
  }

  return (
    <MobileScreen
      title="ขอลา"
      backHref={LIST}
      contentClassName="space-y-3.5 p-4"
      footer={
        <MobileActionFooter>
          <MobilePrimaryButton
            type="submit"
            form={FORM_ID}
            disabled={!!blockedMessage || createMutation.isPending}
          >
            {blockedMessage ? (blockedIsSunday ? "เลือกวันอื่นก่อนส่ง" : "วันลาไม่พอ — แก้ไขก่อนส่ง") : createMutation.isPending ? "กำลังส่ง…" : "ส่งคำขอลา"}
          </MobilePrimaryButton>
        </MobileActionFooter>
      }
    >
      {blockedMessage && <MobileAlertBanner tone="danger">{blockedMessage}</MobileAlertBanner>}

      <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-3.5">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2.5 text-[13px] font-semibold text-foreground">ประเภทการลา</p>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_ORDER.map((t) => {
              const selected = type === t;
              const bal = balanceMap.get(t);
              const sub =
                UNLIMITED_TYPES.includes(t)
                  ? "ไม่จำกัด"
                  : !bal
                    ? "—"
                    : bal.configured
                      ? `คงเหลือ ${bal.remaining} วัน${bal.totalHours > 0 ? ` · ${bal.remainingHours} ชม.` : ""}`
                      : "ยังไม่ได้ตั้งค่า";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    form.setValue("type", t, { shouldValidate: true });
                    // Hourly leave isn't offered for this type — fall back to
                    // a full day rather than leaving an hour-unit selection
                    // the picker below can no longer show.
                    if (!canTakeHourly(t) && form.getValues("unit") === "HOUR") onDurationChange("FULL_DAY");
                  }}
                  className={cn(
                    "rounded-[10px] border-[1.5px] p-3 text-left transition active:scale-[0.99]",
                    selected
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <div className="text-[13px] font-semibold">{LEAVE_TYPE_LABEL[t]}</div>
                  <div className="text-[11px] text-muted-foreground">{sub}</div>
                </button>
              );
            })}
          </div>

          <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">ระยะเวลาลา</p>
          <label className="block rounded-[10px] border border-border px-3 py-2.5">
            <span className="block text-[10px] text-muted-foreground">เลือกระยะเวลา</span>
            <select
              className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
              value={durationValue}
              onChange={(e) => onDurationChange(e.target.value)}
            >
              {durationValue === "" && <option value="">เลือกระยะเวลา</option>}
              <option value="FULL_DAY">เต็มวัน</option>
              <option value="HALF_MORNING">ครึ่งวัน (ช่วงเช้า)</option>
              <option value="HALF_AFTERNOON">ครึ่งวัน (ช่วงบ่าย)</option>
              {showHourlyOption &&
                HOUR_OPTIONS.map((n) => (
                  <option key={n} value={`HOUR_${n}`}>
                    ลา {n} ชั่วโมง
                  </option>
                ))}
            </select>
          </label>

          {durationValue === "FULL_DAY" ? (
            <>
              <p className="mb-2 mt-3 text-[13px] font-semibold text-foreground">ช่วงวันที่ลา</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-[10px] border border-border px-3 py-2.5">
                  <span className="block text-[10px] text-muted-foreground">เริ่มลา</span>
                  <input
                    type="date"
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                    {...form.register("startDate", {
                      onChange: (e) => {
                        const next = e.target.value as string;
                        const currentEnd = form.getValues("endDate");
                        if (!currentEnd || currentEnd < next) form.setValue("endDate", next);
                      },
                    })}
                  />
                </label>
                <label className="rounded-[10px] border border-border px-3 py-2.5">
                  <span className="block text-[10px] text-muted-foreground">ถึงวันที่</span>
                  <input
                    type="date"
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                    {...form.register("endDate")}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 mt-3 text-[13px] font-semibold text-foreground">วันที่ลา</p>
              <label className="block rounded-[10px] border border-border px-3 py-2.5">
                <span className="block text-[10px] text-muted-foreground">วันที่</span>
                <input
                  type="date"
                  className="mt-0.5 w-full appearance-none border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                  {...form.register("startDate", {
                    onChange: (e) => form.setValue("endDate", e.target.value),
                  })}
                />
              </label>
            </>
          )}

          {isHourly && (
            <>
              <p className="mb-2 mt-3 text-[13px] font-semibold text-foreground">เวลาเริ่ม</p>
              <label className="block rounded-[10px] border border-border px-3 py-2.5">
                <span className="block text-[10px] text-muted-foreground">เวลาเริ่ม (สิ้นสุด {endTime || "—"} น.)</span>
                <TimeSelect
                  className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                  {...form.register("startTime", {
                    onChange: (e) => {
                      const newStart = e.target.value as string;
                      const hours = startTime && endTime ? computeLeaveHours(startTime, endTime) : 1;
                      form.setValue("endTime", addHoursToTime(newStart, hours), { shouldValidate: true });
                    },
                  })}
                />
              </label>
            </>
          )}

          <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">แนบไฟล์ประกอบ (ถ้ามี)</p>
          <FileAttachField
            value={form.watch("attachmentUrl")}
            onChange={(v) => form.setValue("attachmentUrl", v, { shouldValidate: true })}
            label="แนบใบรับรองแพทย์"
          />

          <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">เหตุผล</p>
          <textarea
            rows={3}
            placeholder="ระบุเหตุผลการลา"
            className="min-h-[72px] w-full resize-none rounded-[10px] border border-border bg-transparent px-3 py-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            {...form.register("reason")}
          />

          {half ? (
            <p className="mt-3 text-xs text-muted-foreground">
              รวมทั้งหมด{" "}
              <span className="font-semibold text-foreground">
                ครึ่งวัน{halfDayPeriod ? ` (${HALF_DAY_PERIOD_LABEL[halfDayPeriod]})` : ""}
              </span>
            </p>
          ) : (
            preview !== null && (
              <p className="mt-3 text-xs text-muted-foreground">
                รวมทั้งหมด <span className="font-semibold text-foreground">{preview}</span> {isHourly ? "ชั่วโมง" : "วัน (นับจันทร์–เสาร์ ไม่นับวันอาทิตย์)"}
              </p>
            )
          )}
        </div>
      </form>
    </MobileScreen>
  );
}
