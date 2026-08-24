"use client";

import { Palmtree, Stethoscope, User, CircleDollarSign, CalendarClock, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBalances } from "./hooks";
import { LEAVE_TYPE_LABEL } from "./labels";
import type { LeaveType } from "./types";

const STYLE: Record<LeaveType, { icon: LucideIcon; chip: string; bar: string }> = {
  ANNUAL: { icon: Palmtree, chip: "bg-primary/10 text-primary", bar: "bg-primary" },
  SICK: { icon: Stethoscope, chip: "bg-warning/10 text-warning", bar: "bg-warning" },
  PERSONAL: { icon: User, chip: "bg-info/10 text-info", bar: "bg-info" },
  UNPAID: { icon: CircleDollarSign, chip: "bg-destructive/10 text-destructive", bar: "bg-destructive" },
  OTHER: { icon: CalendarClock, chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
};

export function BalanceCards() {
  const { data, isLoading } = useBalances();
  const balances = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        ยังไม่มีข้อมูลโควตาวันลาสำหรับปีนี้
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {balances.map((b) => {
        const remaining = Math.max(0, b.totalDays - b.usedDays);
        const pct = b.totalDays > 0 ? Math.min(100, (b.usedDays / b.totalDays) * 100) : 0;
        const st = STYLE[b.type] ?? STYLE.OTHER;
        const Icon = st.icon;
        return (
          <Card key={b.id} className="gap-3 p-4 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {LEAVE_TYPE_LABEL[b.type]}
              </span>
              <span className={cn("flex size-8 items-center justify-center rounded-lg", st.chip)}>
                <Icon className="size-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{remaining}</span>
              <span className="text-xs text-muted-foreground">/ {b.totalDays} วัน คงเหลือ</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", st.bar)} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">ใช้ไป {b.usedDays} วัน</p>
            </div>
            {b.totalHours > 0 && (
              <p className="border-t border-border pt-1.5 text-[11px] text-muted-foreground">
                ลาเป็นชั่วโมง: เหลือ <span className="font-medium text-foreground">{Math.max(0, b.totalHours - b.usedHours)}</span> จาก {b.totalHours} ชม.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
