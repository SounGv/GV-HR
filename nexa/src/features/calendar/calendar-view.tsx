"use client";

import { PageActions } from "@/components/layout/page-chrome";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

import { DayPanel, dayLabel, SOLID_STATUS } from "./day-panel";
import { useMonth, useDeleteEvent, useDayAttendance, useMonthCounts } from "./hooks";
import type { CalendarItem, CalendarSource, MyDayStatus } from "./types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// Favpo draws every event as a solid blue bar; a holiday is a plain grey one. The kind is read from the legend and the words in the bar.
const SOURCE_STYLE: Record<CalendarSource, string> = {
  holiday: "border border-border bg-muted text-foreground",
  leave: "bg-primary text-primary-foreground",
  training: "bg-primary text-primary-foreground",
  event: "bg-primary text-primary-foreground",
  evaluation: "bg-primary text-primary-foreground",
  meeting: "bg-primary text-primary-foreground",
};
const SOURCE_DOT: Record<CalendarSource, string> = {
  holiday: "border border-border bg-muted",
  leave: "bg-primary",
  training: "bg-primary",
  event: "bg-primary",
  evaluation: "bg-primary",
  meeting: "bg-primary",
};
const SOURCE_LABEL: Record<CalendarSource, string> = {
  holiday: "วันหยุด",
  leave: "การลา",
  training: "อบรม",
  event: "กิจกรรม",
  evaluation: "ประเมินผล",
  meeting: "นัดประชุม",
};

/** Small corner badge on each day cell — the viewer's own attendance status. */
const MY_STATUS_BADGE: Record<MyDayStatus, { label: string; className: string }> = {
  PRESENT: { label: "✓", className: "bg-primary text-primary-foreground" },
  LATE: { label: "!", className: "border border-border bg-card text-foreground" },
  LEAVE: { label: "ล", className: "border border-border bg-card text-foreground" },
  HOLIDAY: { label: "ป", className: "bg-muted text-foreground" },
  WEEKEND: { label: "หย", className: "bg-muted text-foreground" },
  ABSENT: { label: "✕", className: "border border-destructive bg-card text-destructive" },
};
const MY_STATUS_LEGEND: { status: MyDayStatus; label: string }[] = [
  { status: "PRESENT", label: "มาทำงาน" },
  { status: "LEAVE", label: "ลา" },
  { status: "HOLIDAY", label: "วันหยุดประจำปี" },
  { status: "WEEKEND", label: "วันหยุด" },
  { status: "ABSENT", label: "ไม่ลงเวลา" },
];

// Bangkok date on server and browser alike: the server runs in UTC, so a plain Date() disagreed with the browser between 00:00 and 07:00 (hydration error #418).
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}
function currentMonth(): string {
  return todayIso().slice(0, 7);
}
function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Today's company-wide attendance for the count boxes on the home page. It reads the same query the day panel uses for today
 * (same key, so the request is shared and no extra database work happens), and gives nothing back for people who may not see
 * attendance, on a day with nobody checked, or while loading, so the boxes simply leave their extra line out.
 */
function useTodayUsage() {
  const { can } = useAuth();
  const allowed = can("attendance:approve") || can("attendance:manage");
  const q = useDayAttendance(todayIso(), allowed);
  const d = q.data?.data;
  return d && !d.isFuture && d.total > 0 ? d : null;
}

/** Under the headcount: how many of them use the clock-in app and how many never clocked in. Empty when unknown. */
export function HeadcountUsage() {
  const d = useTodayUsage();
  if (!d) return null;
  return (
    <>
      ใช้แอพลงเวลา {d.total} คน · ยังไม่เคยลงเวลา {d.notChecked} คน
    </>
  );
}

/** Small unit text after "present today": "จาก N คนที่ใช้แอพ", or plain "คน" when N is unknown. */
export function PresentOfApp() {
  const d = useTodayUsage();
  return <>{d ? `จาก ${d.total} คนที่ใช้แอพ` : "คน"}</>;
}

/** The month calendar (home page and the calendar page): head-count chips in each cell and a sticky panel for the chosen day. */
export function CalendarView() {
  const { can } = useAuth();
  const canManage = can("calendar:create");
  const canSeeAttendance = can("attendance:approve") || can("attendance:manage");

  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(todayIso());
  const [deleteTarget, setDeleteTarget] = useState<CalendarItem | null>(null);

  const { data, isLoading, isError, refetch } = useMonth(month);
  const countsQuery = useMonthCounts(month, canSeeAttendance);
  const dayCounts = countsQuery.data?.data.days;
  const deleteMut = useDeleteEvent();
  const items = useMemo(() => data?.data.items ?? [], [data]);
  const myStatus = data?.data.myStatus ?? {};

  const bucket = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return map;
  }, [items]);

  const leavePeople = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const it of items) {
      if (it.source !== "leave") continue;
      const set = map.get(it.date) ?? new Set<string>();
      set.add(it.title);
      map.set(it.date, set);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startWeekday = first.getUTCDay();
    const gridStart = new Date(first.getTime() - startWeekday * 86_400_000);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart.getTime() + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      return { iso, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1 };
    });
  }, [month]);

  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${THAI_MONTHS[m - 1]} ${y + 543}`;
  const today = todayIso();
  const selectedItems = selected ? bucket.get(selected) ?? [] : [];
  const selectedLeave = selectedItems.filter((it) => it.source === "leave");
  const selectedOther = selectedItems.filter((it) => it.source !== "leave");
  const dayQuery = useDayAttendance(selected, canSeeAttendance);
  const selectedLabel = selected ? dayLabel(selected) : "";

  const newEventHref = selected ? `/calendar/events/new?date=${selected}` : "/calendar/events/new";

  async function confirmDelete() {
    if (!deleteTarget?.eventId) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.eventId);
      toast.success("ลบกิจกรรมแล้ว");
      setDeleteTarget(null);
    } catch {
      toast.error("ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonth(month, -1))} aria-label="เดือนก่อน">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-lg font-semibold">{monthLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonth(month, 1))} aria-label="เดือนถัดไป">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonth())}>
            วันนี้
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            {(Object.keys(SOURCE_LABEL) as CalendarSource[]).map((s) => (
              <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", SOURCE_DOT[s])} />
                {SOURCE_LABEL[s]}
              </span>
            ))}
          </div>
          {canManage && (
            <PageActions>
              <Button size="sm" render={<Link href={newEventHref} />}>
                <Plus className="size-4" /> เพิ่มกิจกรรม
              </Button>
            </PageActions>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="p-2 sm:p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
              <span className="text-xs font-medium text-muted-foreground">ของฉัน:</span>
              {MY_STATUS_LEGEND.map(({ status, label }) => (
                <span key={status} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs font-bold",
                      MY_STATUS_BADGE[status].className,
                    )}
                  >
                    {MY_STATUS_BADGE[status].label}
                  </span>
                  {label}
                </span>
              ))}
            </div>
            {canSeeAttendance && (
              <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
                <span className="text-[13px] font-medium text-muted-foreground">ในช่องวัน (จำนวนคน):</span>
                {(
                  [
                    ["ABSENT", "ขาดงาน"],
                    ["ON_LEAVE", "ลางาน"],
                    ["LATE", "มาสาย"],
                  ] as const
                ).map(([st, label]) => (
                  <span key={st} className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                    <span className={cn("size-3 rounded-[3px] border", SOLID_STATUS[st])} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {isLoading
                ? Array.from({ length: 42 }, (_, i) => <Skeleton key={i} className="min-h-[92px] rounded-lg sm:min-h-[112px]" />)
                : cells.map((c, idx) => {
                    const allItems = bucket.get(c.iso) ?? [];
                    const dayItems = allItems.filter((it) => it.source !== "leave");
                    const counted = canSeeAttendance ? dayCounts?.[c.iso] : undefined;
                    const chips: { status: "ABSENT" | "ON_LEAVE" | "LATE"; n: number; short: string; label: string }[] = counted
                      ? [
                          { status: "ABSENT", n: counted.absent, short: "ขาด", label: "ขาดงาน" },
                          { status: "ON_LEAVE", n: counted.leave, short: "ลา", label: "ลางาน" },
                          { status: "LATE", n: counted.late, short: "สาย", label: "มาสาย" },
                        ]
                      : [{ status: "ON_LEAVE", n: leavePeople.get(c.iso)?.size ?? 0, short: "ลา", label: "ลางาน" }];
                    const status = myStatus[c.iso];
                    const isToday = c.iso === today;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    return (
                      <button
                        key={c.iso}
                        onClick={() => setSelected(c.iso)}
                        aria-label={[
                          c.iso,
                          ...chips.filter((chip) => chip.n > 0).map((chip) => `${chip.label} ${chip.n} คน`),
                        ].join(" ")}
                        className={cn(
                          "relative flex min-h-[92px] flex-col gap-[3px] rounded-lg border px-[7px] py-1.5 text-left transition sm:min-h-[112px]",
                          !c.inMonth
                            ? "border-dashed bg-transparent text-muted-foreground"
                            : isToday
                              ? "bg-primary/15"
                              : isWeekend
                                ? "bg-muted"
                                : "bg-card",
                          isToday
                            ? "border-[3px] border-primary px-[5px] py-[4px]"
                            : selected === c.iso
                              ? "border-primary ring-1 ring-primary"
                              : "border-border",
                        )}
                      >
                        {status && (
                          <span
                            className={cn(
                              "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full text-xs font-bold",
                              MY_STATUS_BADGE[status].className,
                            )}
                            title={MY_STATUS_LEGEND.find((l) => l.status === status)?.label}
                          >
                            {MY_STATUS_BADGE[status].label}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-sm leading-[1.4] font-semibold tabular-nums">
                          {isToday ? (
                            <>
                              <span className="flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground">
                                {c.day}
                              </span>
                              <span className="text-xs font-semibold text-[#0d47a1] dark:text-primary">วันนี้</span>
                            </>
                          ) : (
                            c.day
                          )}
                        </span>
                        <div className="flex flex-col gap-[3px]">
                          {chips
                            .filter((chip) => chip.n > 0)
                            .map((chip) => (
                              <span
                                key={chip.status}
                                className={cn(
                                  "flex h-[21px] items-center justify-between rounded-md border px-[7px] text-[12.5px] font-semibold whitespace-nowrap sm:h-[26px] sm:text-sm",
                                  SOLID_STATUS[chip.status],
                                )}
                                title={`${chip.label} ${chip.n} คน`}
                              >
                                <span>{chip.short}</span>
                                <b className="font-bold tabular-nums">{chip.n}</b>
                              </span>
                            ))}
                        </div>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayItems.slice(0, 2).map((it) => (
                            <span
                              key={it.id}
                              title={it.title}
                              className={cn("truncate rounded px-1 text-xs leading-snug", SOURCE_STYLE[it.source])}
                            >
                              {it.title}
                            </span>
                          ))}
                          {dayItems.length > 2 && (
                            <span
                              className="px-1 text-xs font-medium text-primary"
                              title={`มีอีก ${dayItems.length - 2} รายการ กดที่วันนี้เพื่อดูทั้งหมด`}
                            >
                              อีก {dayItems.length - 2} รายการ
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
            </div>
          </Card>

          <Card className="h-fit self-start p-4 lg:sticky lg:top-3">
            {selected ? (
              <DayPanel
                label={selectedLabel}
                loading={canSeeAttendance && dayQuery.isLoading}
                day={dayQuery.data?.data}
                leaveItems={selectedLeave}
                solid
              />
            ) : (
              <p className="text-sm font-semibold">เลือกวันที่</p>
            )}
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">วันหยุด กิจกรรม และนัดหมาย</p>
              {selectedOther.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีรายการอื่นในวันนี้</p>
              ) : (
                selectedOther.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className={cn("mt-1 size-2 shrink-0 rounded-full", SOURCE_DOT[it.source])} />
                      <div className="min-w-0">
                        {it.href ? (
                          <Link
                            href={it.href}
                            className="text-sm font-medium leading-snug text-primary hover:underline"
                          >
                            {it.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium leading-snug">{it.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{SOURCE_LABEL[it.source]}</p>
                      </div>
                    </div>
                    {canManage && it.eventId && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          render={<Link href={`/calendar/events/${it.eventId}/edit`} />}
                          aria-label="แก้ไข"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => setDeleteTarget(it)}
                          aria-label="ลบ"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {canManage && selected && (
                <Button variant="outline" size="sm" className="w-full" render={<Link href={newEventHref} />}>
                  <Plus className="size-4" /> เพิ่มในวันนี้
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบกิจกรรม?"
        description={deleteTarget?.title}
        confirmLabel="ลบ"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
