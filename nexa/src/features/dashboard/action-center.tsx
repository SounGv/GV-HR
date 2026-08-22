import Link from "next/link";
import {
  CalendarDays,
  Timer,
  ReceiptText,
  GitBranch,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardActions } from "./service";

interface ApprovalTile {
  key: keyof DashboardActions["approvals"];
  label: string;
  href: string;
  icon: LucideIcon;
  tone: string;
}

// Monochrome-green icon-chip system (redesign spec) — same chip for every
// approval type, matching the nav/menu icon treatment.
const ICON_CHIP = "bg-icon-chip-bg text-icon-chip-fg";
const TILES: ApprovalTile[] = [
  { key: "leave", label: "การลารออนุมัติ", href: "/leave", icon: CalendarDays, tone: ICON_CHIP },
  { key: "overtime", label: "OT รออนุมัติ", href: "/overtime", icon: Timer, tone: ICON_CHIP },
  { key: "expense", label: "เบิกจ่ายรออนุมัติ", href: "/expenses", icon: ReceiptText, tone: ICON_CHIP },
  { key: "workflow", label: "คำขออนุมัติ", href: "/workflows", icon: GitBranch, tone: ICON_CHIP },
];

export function ActionCenter({ data }: { data: DashboardActions }) {
  const tiles = TILES.filter((t) => data.approvals[t.key] > 0);
  const nothingToApprove = tiles.length === 0;
  const showPersonal = !!data.shiftToday || data.myPending > 0;

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
      <h2 className="text-sm font-semibold text-foreground">ศูนย์การดำเนินการ</h2>

      {!nothingToApprove && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.key} href={t.href} className="group">
                <Card className="gap-0 p-4 transition group-hover:border-primary/40">
                  <div className="flex items-center justify-between">
                    <span className={cn("flex size-8 items-center justify-center rounded-lg", t.tone)}>
                      <Icon className="size-4" />
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight">
                    {data.approvals[t.key]}
                  </p>
                  <p className="text-sm text-muted-foreground">{t.label}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {showPersonal && (
        <div className="flex flex-wrap items-center gap-2">
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
              คำขอของฉันที่รออนุมัติ:{" "}
              <span className="font-medium">{data.myPending}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
