"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBalances } from "./hooks";
import { LEAVE_TYPE_LABEL } from "./labels";

export function BalanceCards() {
  const { data, isLoading } = useBalances();
  const balances = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
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
        return (
          <Card key={b.id} className="gap-2 p-4">
            <p className="text-sm text-muted-foreground">{LEAVE_TYPE_LABEL[b.type]}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums">{remaining}</span>
              <span className="text-xs text-muted-foreground">/ {b.totalDays} วัน</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
