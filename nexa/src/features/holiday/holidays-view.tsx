"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Bell, BellOff, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

import { useHolidays, useDeleteHoliday } from "./hooks";
import type { Holiday } from "./types";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i);

const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function HolidaysView() {
  const { can } = useAuth();
  const canManage = can("holiday:create");
  const canEdit = can("holiday:update");
  const canDelete = can("holiday:delete");

  const [year, setYear] = useState(CURRENT_YEAR);
  const { data, isLoading, isError, refetch } = useHolidays(year);
  const deleteMutation = useDeleteHoliday();

  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const grouped = useMemo(() => {
    const holidays = data?.data ?? [];
    const map = new Map<number, Holiday[]>();
    for (const h of holidays) {
      const m = new Date(h.date).getUTCMonth();
      const arr = map.get(m) ?? [];
      arr.push(h);
      map.set(m, arr);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("ลบวันหยุดเรียบร้อย");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                ปี {y + 543}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManage && (
          <Button render={<Link href="/holidays/new" />}>
            <Plus className="size-4" /> เพิ่มวันหยุด
          </Button>
        )}
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={5} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="ยังไม่มีวันหยุด"
          description={canManage ? "เพิ่มวันหยุดแรกของปีนี้" : "ยังไม่มีข้อมูลวันหยุดในปีนี้"}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, items]) => (
            <div key={month} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{MONTHS[month]}</h3>
              <Card className="divide-y divide-border p-0">
                {items.map((h) => {
                  const d = new Date(h.date);
                  const day = d.getUTCDate();
                  const weekday = new Intl.DateTimeFormat("th-TH", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(d);
                  return (
                    <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <span className="text-base font-semibold leading-none">{day}</span>
                        <span className="text-[10px]">{weekday}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{h.name}</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              h.type === "NATIONAL"
                                ? "bg-info/10 text-info"
                                : "bg-warning/10 text-warning",
                            )}
                          >
                            {h.type === "NATIONAL" ? "วันหยุดราชการ" : "วันหยุดบริษัท"}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {h.notifyEnabled ? (
                              <>
                                <Bell className="size-3" /> แจ้งเตือน
                              </>
                            ) : (
                              <>
                                <BellOff className="size-3" /> ปิดแจ้งเตือน
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="แก้ไข"
                              render={<Link href={`/holidays/${h.id}/edit`} />}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="ลบ"
                              onClick={() => setDeleteTarget(h)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันการลบวันหยุด"
        description={deleteTarget ? `ต้องการลบ "${deleteTarget.name}" ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ลบ"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
