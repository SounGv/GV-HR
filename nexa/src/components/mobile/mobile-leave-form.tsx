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
import { LEAVE_TYPES, LEAVE_UNITS } from "@/features/leave/schema";
import { computeLeaveDays, computeLeaveHours, HOURLY_LEAVE_TYPES } from "@/features/leave/days";
import { LEAVE_TYPE_LABEL } from "@/features/leave/labels";
import { useBalances, useCreateLeave } from "@/features/leave/hooks";
import type { LeaveType } from "@/features/leave/types";
import { MobileActionFooter, MobilePrimaryButton } from "./mobile-action-footer";
import { MobileAlertBanner, MobileSuccessCard } from "./mobile-alert-banner";
import { MobileScreen } from "./mobile-screen";

const FORM_ID = "mobile-leave-form";
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

const TYPE_ORDER: LeaveType[] = ["SICK", "PERSONAL", "ANNUAL", "UNPAID"];

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

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "SICK",
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

  const [type, start, end, half, unit, startTime, endTime] = form.watch([
    "type",
    "startDate",
    "endDate",
    "halfDay",
    "unit",
    "startTime",
    "endTime",
  ]);
  const showHourlyOption = isHourlyType(type);
  const isHourly = showHourlyOption && unit === "HOUR";
  const preview = isHourly
    ? startTime && endTime && endTime > startTime
      ? computeLeaveHours(startTime, endTime)
      : null
    : start && end && end >= start
      ? computeLeaveDays(new Date(start), new Date(end), half)
      : null;

  const balanceMap = useMemo(() => {
    const map = new Map<LeaveType, { remaining: number; total: number; remainingHours: number; totalHours: number }>();
    for (const b of balanceData?.data ?? []) {
      map.set(b.type, {
        remaining: Math.max(0, b.totalDays - b.usedDays),
        total: b.totalDays,
        remainingHours: Math.max(0, b.totalHours - b.usedHours),
        totalHours: b.totalHours,
      });
    }
    return map;
  }, [balanceData]);

  const blockedMessage = useMemo(() => {
    if (!preview || type === "UNPAID" || type === "OTHER") return null;
    const bal = balanceMap.get(type);
    if (!bal) return null;
    if (isHourly) {
      if (preview > bal.remainingHours) {
        return (
          <>
            ชั่วโมง{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ <b>{bal.remainingHours} ชม.</b> แต่ขอลา{" "}
            <b>{preview} ชม.</b> กรุณาเลือกเวลาใหม่
          </>
        );
      }
      return null;
    }
    if (preview > bal.remaining) {
      return (
        <>
          วัน{LEAVE_TYPE_LABEL[type]}คงเหลือไม่พอ — คุณมีสิทธิ์คงเหลือ <b>{bal.remaining} วัน</b> แต่ขอลา{" "}
          <b>{preview} วัน</b> กรุณาเลือกวันใหม่ หรือเปลี่ยนเป็นลาไม่รับค่าจ้าง
        </>
      );
    }
    return null;
  }, [preview, type, balanceMap, isHourly]);

  async function onSubmit(values: FormSchema) {
    if (blockedMessage) return;
    try {
      await createMutation.mutateAsync(values);
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
              value: wasHourly ? (hours != null ? `${hours} ชม.` : "—") : days != null ? `${days} วัน` : "—",
            },
            { label: "สถานะ", value: "รออนุมัติ", highlight: true },
          ]}
          action={
            <MobilePrimaryButton onClick={() => router.push("/services")}>
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
            {blockedMessage ? "วันลาไม่พอ — แก้ไขก่อนส่ง" : createMutation.isPending ? "กำลังส่ง…" : "ส่งคำขอลา"}
          </MobilePrimaryButton>
        </MobileActionFooter>
      }
    >
      {blockedMessage && <MobileAlertBanner tone="danger">{blockedMessage}</MobileAlertBanner>}

      <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2.5 text-[13px] font-semibold text-foreground">ประเภทการลา</p>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_ORDER.map((t) => {
              const selected = type === t;
              const bal = balanceMap.get(t);
              const sub =
                t === "UNPAID"
                  ? "ไม่จำกัด"
                  : bal
                    ? `คงเหลือ ${bal.remaining} วัน`
                    : "—";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    form.setValue("type", t, { shouldValidate: true });
                    if (!isHourlyType(t)) form.setValue("unit", "DAY");
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

          {showHourlyOption && (
            <>
              <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">รูปแบบการลา</p>
              <div className="grid grid-cols-2 gap-2">
                {LEAVE_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => form.setValue("unit", u, { shouldValidate: true })}
                    className={cn(
                      "rounded-[10px] border-[1.5px] p-3 text-center text-[13px] font-semibold transition active:scale-[0.99]",
                      unit === u
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {u === "DAY" ? "เต็มวัน / ครึ่งวัน" : "เป็นชั่วโมง"}
                  </button>
                ))}
              </div>
            </>
          )}

          {isHourly ? (
            <>
              <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">วันที่ลา</p>
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

              <p className="mb-2 mt-3 text-[13px] font-semibold text-foreground">ช่วงเวลาที่ลา</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-[10px] border border-border px-3 py-2.5">
                  <span className="block text-[10px] text-muted-foreground">เวลาเริ่ม</span>
                  <input
                    type="time"
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                    {...form.register("startTime")}
                  />
                </label>
                <label className="rounded-[10px] border border-border px-3 py-2.5">
                  <span className="block text-[10px] text-muted-foreground">เวลาสิ้นสุด</span>
                  <input
                    type="time"
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                    {...form.register("endTime")}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 mt-4 text-[13px] font-semibold text-foreground">ช่วงวันที่ลา</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-[10px] border border-border px-3 py-2.5">
                  <span className="block text-[10px] text-muted-foreground">เริ่มลา</span>
                  <input
                    type="date"
                    className="mt-0.5 w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-foreground outline-none"
                    {...form.register("startDate")}
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

              <label className="mt-3 flex items-center justify-between rounded-[10px] border border-border px-3 py-2.5">
                <span className="text-[13px] font-medium text-foreground">ลาครึ่งวัน</span>
                <input type="checkbox" className="size-4 accent-primary" {...form.register("halfDay")} />
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

          {preview !== null && (
            <p className="mt-3 text-xs text-muted-foreground">
              รวมทั้งหมด <span className="font-semibold text-foreground">{preview}</span> {isHourly ? "ชั่วโมง" : "วัน"}
            </p>
          )}
        </div>
      </form>
    </MobileScreen>
  );
}
