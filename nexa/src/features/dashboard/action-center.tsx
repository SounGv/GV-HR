import Link from "next/link";
import type { ReactNode } from "react";
import { ReceiptText, GitBranch, CalendarClock, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LeaveIcon, OvertimeIcon } from "@/components/shared/illustrated-icons";
import type { DashboardActions } from "./service";

interface ApprovalTile {
  key: keyof DashboardActions["approvals"];
  label: string;
  href: string;
  render: () => ReactNode;
}

const TILES: ApprovalTile[] = [
  { key: "leave", label: "การลารออนุมัติ", href: "/leave?view=overview", render: () => <LeaveIcon size={34} /> },
  { key: "overtime", label: "OT รออนุมัติ", href: "/overtime?view=overview", render: () => <OvertimeIcon size={34} /> },
  {
    key: "expense",
    label: "เบิกจ่ายรออนุมัติ",
    href: "/expenses",
    render: () => (
      <span className="flex size-[34px] items-center justify-center rounded-lg bg-[#14B8A6]">
        <ReceiptText className="size-[18px] text-white" />
      </span>
    ),
  },
  {
    key: "workflow",
    label: "คำขออนุมัติ",
    href: "/workflows",
    render: () => (
      <span className="flex size-[34px] items-center justify-center rounded-lg bg-[#6366F1]">
        <GitBranch className="size-[18px] text-white" />
      </span>
    ),
  },
];

/**
 * "รอคุณอนุมัติ" — a dark banner (redesign spec: N mockup) with the total
 * pending count in lime up front, one pill per approval type that actually
 * has something pending, and a CTA into the first one. Falls back to a
 * plain empty-state card when there's nothing to approve and no personal
 * shift/pending-request info to show either.
 */
export function ActionCenter({ data }: { data: DashboardActions }) {
  const tiles = TILES.filter((t) => data.approvals[t.key] > 0);
  const nothingToApprove = tiles.length === 0;
  const showPersonal = !!data.shiftToday || data.myPending > 0;
  const totalApprovals = tiles.reduce((sum, t) => sum + data.approvals[t.key], 0);

  if (nothingToApprove && !showPersonal) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">ศูนย์การดำเนินการ</h2>
        <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" />
          ไม่มีงานค้างที่ต้องดำเนินการ
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {!nothingToApprove && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-sidebar p-5 text-white">
          <div className="flex flex-col">
            <span className="text-sm text-slate-300">รอคุณอนุมัติ</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-[#CDEB03] tabular-nums">{totalApprovals}</span>
              <span className="text-base">รายการ</span>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap gap-3">
            {tiles.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="flex min-w-[190px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 transition hover:bg-white/15"
              >
                {t.render()}
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold tabular-nums">{data.approvals[t.key]}</span>
                  <span className="text-xs text-slate-300">{t.label}</span>
                </div>
              </Link>
            ))}
          </div>

          <Link
            href={tiles[0].href}
            className="flex h-12 items-center rounded-xl bg-[#CDEB03] px-5 text-base font-bold text-[#131516] transition hover:brightness-105"
          >
            ตรวจอนุมัติ
          </Link>
        </div>
      )}

      {showPersonal && (
        <div className={cn("flex flex-wrap items-center gap-2", nothingToApprove && "pt-0")}>
          {data.shiftToday && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              <CalendarClock className="size-4 text-primary" />
              เวรวันนี้: <span className="font-medium">{data.shiftToday.name}</span>
              <span className="text-muted-foreground">
                {data.shiftToday.startTime}–{data.shiftToday.endTime}
              </span>
            </span>
          )}
          {data.myPending > 0 && (
            <Link
              href="/workflows"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:border-primary/40"
            >
              คำขอของฉันที่รออนุมัติ: <span className="font-medium">{data.myPending}</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
