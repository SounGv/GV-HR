"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { useMonth } from "@/features/calendar/hooks";
import type { CalendarSource, MyDayStatus } from "@/features/calendar/types";
import { MobileScreen } from "./mobile-screen";
import { EmptyState, ErrorState } from "@/components/shared/states";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const SOURCE_DOT: Record<CalendarSource, string> = {
  holiday: "bg-destructive",
  leave: "bg-warning",
  training: "bg-primary",
  event: "bg-emerald-500",
  evaluation: "bg-lime-600",
};
const SOURCE_LABEL: Record<CalendarSource, string> = {
  holiday: "วันหยุด",
  leave: "การลา",
  training: "อบรม",
  event: "กิจกรรม",
  evaluation: "ประเมินผล",
};

const MY_STATUS_BADGE: Record<MyDayStatus, { label: string; className: string }> = {
  PRESENT: { label: "✓", className: "bg-success text-white" },
  LATE: { label: "!", className: "bg-warning text-white" },
  LEAVE: { label: "ล", className: "bg-warning text-white" },
  HOLIDAY: { label: "ป", className: "bg-destructive text-white" },
  WEEKEND: { label: "หย", className: "bg-muted-foreground/60 text-white" },
  ABSENT: { label: "✕", className: "bg-destructive text-white" },
};
const MY_STATUS_LEGEND: { status: MyDayStatus; label: string }[] = [
  { status: "PRESENT", label: "มาทำงาน" },
  { status: "LEAVE", label: "ลา" },
  { status: "HOLIDAY", label: "วันหยุดประจำปี" },
  { status: "WEEKEND", label: "วันหยุด" },
  { status: "ABSENT", label: "ไม่ลงเวลา" },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function addMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Mobile-first month grid for "ปฏิทินองค์กร" — same `useMonth()` data as the
 * desktop CalendarView, but day cells show only a status corner badge + up
 * to 3 source dots (no inline event-title chips, which truncate badly at
 * phone width); the selected day's actual items list below the grid.
 */
export function MobileCalendarView() {
  const { can } = useAuth();
  const canManage = can("calendar:create");

  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(todayIso());

  const { data, isLoading, isError, refetch } = useMonth(month);
  const items = useMemo(() => data?.data.items ?? [], [data]);
  const myStatus = data?.data.myStatus ?? {};

  const bucket = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
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
  const newEventHref = selected ? `/calendar/events/new?date=${selected}` : "/calendar/events/new";

  return (
    <MobileScreen title="ปฏิทินองค์กร" backHref="/dashboard" contentClassName="space-y-3.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonth(addMonth(month, -1))}
          aria-label="เดือนก่อน"
          className="flex size-9 items-center justify-center rounded-full bg-card shadow-sm active:scale-95"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-base font-semibold text-foreground">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setMonth(addMonth(month, 1))}
          aria-label="เดือนถัดไป"
          className="flex size-9 items-center justify-center rounded-full bg-card shadow-sm active:scale-95"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMonth(currentMonth());
            setSelected(todayIso());
          }}
          className="ml-1 shrink-0 rounded-full bg-card px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm"
        >
          วันนี้
        </button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="rounded-2xl bg-card p-2.5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">ของฉัน:</span>
            {MY_STATUS_LEGEND.map(({ status, label }) => (
              <span key={status} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold",
                    MY_STATUS_BADGE[status].className,
                  )}
                >
                  {MY_STATUS_BADGE[status].label}
                </span>
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {isLoading
              ? Array.from({ length: 42 }, (_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />)
              : cells.map((c) => {
                  const dayItems = bucket.get(c.iso) ?? [];
                  const status = myStatus[c.iso];
                  const sources = [...new Set(dayItems.map((it) => it.source))].slice(0, 3);
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      onClick={() => setSelected(c.iso)}
                      className={cn(
                        "relative flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition",
                        c.inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground/60",
                        selected === c.iso ? "border-primary ring-1 ring-primary" : "border-transparent",
                      )}
                    >
                      {status && (
                        <span
                          className={cn(
                            "absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full text-[7px] font-bold",
                            MY_STATUS_BADGE[status].className,
                          )}
                        >
                          {MY_STATUS_BADGE[status].label}
                        </span>
                      )}
                      <span
                        className={cn(
                          "font-medium",
                          c.iso === today && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                        )}
                      >
                        {c.day}
                      </span>
                      {sources.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          {sources.map((s) => (
                            <span key={s} className={cn("size-1 rounded-full", SOURCE_DOT[s])} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-card p-3.5 shadow-sm">
        <p className="text-sm font-semibold text-foreground">
          {selected ? `รายการวันที่ ${selected.slice(8)} ${THAI_MONTHS[Number(selected.slice(5, 7)) - 1]}` : "เลือกวันที่"}
        </p>
        <div className="mt-3 space-y-2">
          {selectedItems.length === 0 ? (
            <EmptyState title="ไม่มีรายการ" description="วันนี้ยังไม่มีกิจกรรม" className="py-8" />
          ) : (
            selectedItems.map((it) => (
              <div key={it.id} className="flex items-start gap-2 rounded-xl border border-border p-2.5">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", SOURCE_DOT[it.source])} />
                <div className="min-w-0">
                  {it.href ? (
                    <Link href={it.href} className="text-sm font-medium leading-snug text-accent-foreground">
                      {it.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium leading-snug">{it.title}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{SOURCE_LABEL[it.source]}</p>
                </div>
              </div>
            ))
          )}
          {canManage && selected && (
            <Link
              href={newEventHref}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground"
            >
              <Plus className="size-4" /> เพิ่มกิจกรรมวันนี้
            </Link>
          )}
        </div>
      </div>
    </MobileScreen>
  );
}
