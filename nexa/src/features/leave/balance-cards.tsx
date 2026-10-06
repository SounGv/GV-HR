"use client";

import { Palmtree, Stethoscope, User, CircleDollarSign, CalendarClock, Repeat, TriangleAlert, CircleCheck, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBalances } from "./hooks";
import { LEAVE_TYPE_LABEL } from "./labels";
import type { LeaveBalance, LeaveType } from "./types";

const STYLE: Record<LeaveType, { icon: LucideIcon; chip: string; bar: string }> = {
  ANNUAL: { icon: Palmtree, chip: "bg-primary/10 text-primary", bar: "bg-primary" },
  SICK: { icon: Stethoscope, chip: "bg-warning/10 text-warning", bar: "bg-warning" },
  PERSONAL: { icon: User, chip: "bg-info/10 text-info", bar: "bg-info" },
  UNPAID: { icon: CircleDollarSign, chip: "bg-destructive/10 text-destructive", bar: "bg-destructive" },
  OTHER: { icon: CalendarClock, chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
  HOLIDAY_SWAP: { icon: Repeat, chip: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
};

/** Same order HR knows from the old system: sick, personal, annual; anything else after. */
const ORDER: LeaveType[] = ["SICK", "PERSONAL", "ANNUAL"];
const rank = (t: LeaveType) => {
  const i = ORDER.indexOf(t);
  return i === -1 ? ORDER.length : i;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** One short note per card, as in the old system's "หมายเหตุ" column. Always a word plus an icon, never colour alone. */
function note(total: number, left: number): { text: string; tone: "ok" | "low" | "none"; } {
  if (total === 0) return { text: "ยังไม่มีสิทธิ์ลาประเภทนี้", tone: "none" };
  if (left <= 0) return { text: "ใช้ครบสิทธิ์แล้ว", tone: "low" };
  if (left <= 1) return { text: "เหลือไม่เกิน 1 วัน", tone: "low" };
  return { text: "ปกติ", tone: "ok" };
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "text-3xl font-semibold tracking-tight" : "text-xl font-medium")}>{value}</dd>
    </div>
  );
}

export function BalanceCards() {
  const { data, isLoading } = useBalances();
  const balances: LeaveBalance[] = [...(data?.data ?? [])].sort((a, b) => rank(a.type) - rank(b.type));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
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
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balances.map((b) => {
          const total = r1(b.totalDays);
          const used = r1(b.usedDays);
          const left = r1(Math.max(0, b.totalDays - b.usedDays));
          const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
          const st = STYLE[b.type] ?? STYLE.OTHER;
          const Icon = st.icon;
          const n = note(total, left);
          return (
            <Card key={b.id} className="gap-3 p-4 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{LEAVE_TYPE_LABEL[b.type]}</span>
                <span className={cn("flex size-8 items-center justify-center rounded-lg", st.chip)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              </div>
              {b.daysConfigured ? (
                <>
                  <dl className="grid grid-cols-3 gap-2">
                    <Stat label="สิทธิ์ (วัน)" value={total} />
                    <Stat label="ใช้แล้ว (วัน)" value={used} />
                    <Stat label="คงเหลือ (วัน)" value={left} strong />
                  </dl>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`ใช้ไปแล้ว ${LEAVE_TYPE_LABEL[b.type]}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                    <div className={cn("h-full rounded-full transition-all", st.bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      n.tone === "ok" && "text-success",
                      n.tone === "low" && "text-status-late-fg",
                      n.tone === "none" && "text-muted-foreground",
                    )}
                  >
                    {n.tone === "ok" ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <TriangleAlert className="size-3.5" aria-hidden="true" />}
                    {n.text}
                  </p>
                </>
              ) : (
                // HR hasn't set a real quota for this company yet — showing the
                // historical system fallback (10/30/3) as if it were policy is
                // more misleading than showing nothing. Requesting leave still
                // works normally; only this number is hidden.
                <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้งค่าโควตา — ติดต่อ HR</p>
              )}
              {b.totalHours > 0 && (
                <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">
                  ลาเป็นชั่วโมง: เหลือ <span className="font-medium text-foreground">{Math.max(0, b.totalHours - b.usedHours)}</span> จาก {b.totalHours} ชม.
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">ทศนิยม เช่น 0.1 วัน คือการลาเป็นชั่วโมง ลาไม่รับค่าจ้างและลาอื่นๆ ไม่มีสิทธิ์ให้หัก ดูได้ในประวัติการลา</p>
    </div>
  );
}
