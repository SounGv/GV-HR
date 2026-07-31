"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";

import { EventDialog } from "./event-dialog";
import { useMonth, useDeleteEvent } from "./hooks";
import type { CalendarItem, CalendarSource } from "./types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const SOURCE_STYLE: Record<CalendarSource, string> = {
  holiday: "bg-destructive/15 text-destructive",
  leave: "bg-warning/15 text-warning",
  training: "bg-primary/15 text-primary",
  event: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};
const SOURCE_DOT: Record<CalendarSource, string> = {
  holiday: "bg-destructive",
  leave: "bg-warning",
  training: "bg-primary",
  event: "bg-emerald-500",
};
const SOURCE_LABEL: Record<CalendarSource, string> = {
  holiday: "วันหยุด",
  leave: "การลา",
  training: "อบรม",
  event: "กิจกรรม",
};

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

export function CalendarView() {
  const { can } = useAuth();
  const canManage = can("calendar:create");

  const [month, setMonth] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(todayIso());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<CalendarItem | null>(null);

  const { data, isLoading, isError, refetch } = useMonth(month);
  const deleteMut = useDeleteEvent();
  const items = useMemo(() => data?.data.items ?? [], [data]);

  const bucket = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
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

  function openCreate(date?: string) {
    setEditing(null);
    setDefaultDate(date);
    setDialogOpen(true);
  }

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
            <Button size="sm" onClick={() => openCreate(selected ?? undefined)}>
              <Plus className="size-4" /> เพิ่มกิจกรรม
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {w}
                </div>
              ))}
              {isLoading
                ? Array.from({ length: 42 }, (_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
                : cells.map((c) => {
                    const dayItems = bucket.get(c.iso) ?? [];
                    return (
                      <button
                        key={c.iso}
                        onClick={() => setSelected(c.iso)}
                        className={cn(
                          "flex h-20 flex-col gap-0.5 rounded-md border p-1 text-left transition",
                          c.inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                          selected === c.iso ? "border-primary ring-1 ring-primary" : "border-border",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs font-medium",
                            c.iso === today &&
                              "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground",
                          )}
                        >
                          {c.day}
                        </span>
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          {dayItems.slice(0, 2).map((it) => (
                            <span
                              key={it.id}
                              className={cn("truncate rounded px-1 text-[10px] leading-tight", SOURCE_STYLE[it.source])}
                            >
                              {it.title}
                            </span>
                          ))}
                          {dayItems.length > 2 && (
                            <span className="px-1 text-[10px] text-muted-foreground">
                              +{dayItems.length - 2}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
            </div>
          </Card>

          <Card className="h-fit p-4">
            <p className="text-sm font-semibold">
              {selected ? `รายการวันที่ ${selected.slice(8)} ${THAI_MONTHS[Number(selected.slice(5, 7)) - 1]}` : "เลือกวันที่"}
            </p>
            <div className="mt-3 space-y-2">
              {selectedItems.length === 0 ? (
                <EmptyState title="ไม่มีรายการ" description="วันนี้ยังไม่มีกิจกรรม" className="py-8" />
              ) : (
                selectedItems.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className={cn("mt-1 size-2 shrink-0 rounded-full", SOURCE_DOT[it.source])} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{it.title}</p>
                        <p className="text-xs text-muted-foreground">{SOURCE_LABEL[it.source]}</p>
                      </div>
                    </div>
                    {canManage && it.eventId && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditing(it);
                            setDialogOpen(true);
                          }}
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
                <Button variant="outline" size="sm" className="w-full" onClick={() => openCreate(selected)}>
                  <Plus className="size-4" /> เพิ่มในวันนี้
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing ? { id: editing.eventId!, title: editing.title, type: editing.type, date: editing.date } : null}
        defaultDate={defaultDate}
      />
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
