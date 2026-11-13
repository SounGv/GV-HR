import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarDays, CheckCircle2, GitBranch, PencilLine, ReceiptText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardActions } from "./service";

interface ApprovalTile {
  key: keyof DashboardActions["approvals"];
  label: string;
  href: string;
  icon: typeof ReceiptText;
  /** Chip colours: background, border, icon. */
  tone: string;
}

/** One teal for every request type: types are told apart by icon and label, not colour (gv-one-design-rules). */
const TEAL_CHIP = "border-primary/15 bg-primary/10 text-primary";

const TILES: ApprovalTile[] = [
  { key: "leave", label: "ขอลา", href: "/leave?view=overview", icon: CalendarDays, tone: TEAL_CHIP },
  { key: "overtime", label: "ขอ OT", href: "/overtime?view=overview", icon: Zap, tone: TEAL_CHIP },
  { key: "correction", label: "ขอแก้เวลา", href: "/attendance/corrections", icon: PencilLine, tone: TEAL_CHIP },
  { key: "expense", label: "เบิกจ่าย", href: "/expenses", icon: ReceiptText, tone: TEAL_CHIP },
  { key: "workflow", label: "คำขออนุมัติอื่นๆ", href: "/workflows", icon: GitBranch, tone: TEAL_CHIP },
];

/**
 * "รอคุณอนุมัติ": a white card with the total up front, one row per approval
 * type that has something pending, and a single CTA into the first one. The
 * personal line (today's shift, my own pending requests) sits in the footer.
 */
export function ActionCenter({ data }: { data: DashboardActions }) {
  const tiles = TILES.filter((t) => data.approvals[t.key] > 0);
  const totalApprovals = tiles.reduce((sum, t) => sum + data.approvals[t.key], 0);
  const showPersonal = !!data.shiftToday || data.myPending > 0;

  return (
    <section
      aria-label="รอคุณอนุมัติ"
      className="gv-lift flex flex-1 flex-col rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <h3 className="text-[15px] font-semibold">คำขอทั้งหมด</h3>
      </div>

      {tiles.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pt-2 pb-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          ไม่มีคำขอรออนุมัติ
        </p>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5 px-4">
            <span className="text-[30px] leading-tight font-bold text-[var(--flip7-teal-dark)] tabular-nums">{totalApprovals}</span>
            <span className="text-[13px] text-muted-foreground">รายการ</span>
          </p>
          <ul className="mt-1.5 px-2">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <li key={t.key}>
                  <Link href={t.href} className="gv-row flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-sm">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg border", t.tone)}>
                      <Icon className="size-[15px]" aria-hidden="true" />
                    </span>
                    {t.label}
                    <span className="ml-auto text-[15px] font-semibold tabular-nums">{data.approvals[t.key]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {(tiles.length > 0 || showPersonal) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-3">
          {data.shiftToday && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
              เวรวันนี้ <span className="font-medium text-foreground">{data.shiftToday.name}</span>
              {data.shiftToday.startTime}–{data.shiftToday.endTime}
            </span>
          )}
          {data.myPending > 0 && (
            <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              คำขอของฉันที่รออนุมัติ <span className="font-medium text-foreground tabular-nums">{data.myPending}</span>
            </Link>
          )}
          {tiles.length > 0 && (
            <Link
              href="/requests?view=approvals"
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--flip7-teal-dark)] px-3.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(15,118,110,.2),0_6px_14px_-8px_rgba(15,118,110,.5)] transition-colors hover:bg-[#115e59]"
            >
              เปิดรายการรออนุมัติ <ArrowRight className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
