"use client";

import Link from "next/link";
import { Check, ClipboardCheck, ChevronRight, Clock, ListChecks } from "lucide-react";

import { MobileScreen } from "./mobile-screen";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fullName, getInitials } from "@/lib/format";
import { useReviews } from "@/features/performance/hooks";
import { ReviewCard } from "@/features/performance/review-card";
import { useMyEvaluationAssignments } from "@/features/campaign/hooks";
import type { MyEvaluationAssignment as MyAssignment } from "@/features/campaign/types";
import { RATER_LABEL } from "@/features/campaign/labels";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
}

/**
 * Lightweight mobile-first performance screen — my own review history plus
 * every campaign evaluation I've been asked to do (self/peer/manager/upward),
 * pending AND already-submitted so a finished one stays visible with
 * history instead of vanishing, instead of making phones fight the desktop
 * tab bar (campaigns/9-box/succession). Desktop keeps `PerformanceView`
 * with an equivalent "งานที่ต้องประเมิน" tab.
 */
export function MobilePerformanceView() {
  return (
    <MobileScreen title="ประเมินผล" backHref="/dashboard" preferHistory contentClassName="space-y-4 p-4">
      <PendingSection />
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">ผลประเมินของฉัน</h2>
        <MyReviews />
      </div>
    </MobileScreen>
  );
}

/** Whole days from today (Asia/Bangkok) to the deadline date; 0 = last day, negative = past. */
function daysUntil(endIso: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  return Math.round((Date.parse(endIso.slice(0, 10)) - Date.parse(today)) / 86_400_000);
}

function dueLabel(days: number): string {
  if (days < 0) return "เลยกำหนด";
  if (days === 0) return "ครบกำหนดวันนี้";
  return `เหลือ ${days} วัน`;
}

/** Status is always a word plus an icon, never colour alone. */
function StatusChip({ submitted, days }: { submitted: boolean; days: number }) {
  if (submitted) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-muted px-2.5 py-1 text-xs font-semibold text-success">
        <Check className="size-3.5" aria-hidden="true" /> ส่งแล้ว
      </span>
    );
  }
  if (days < 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive-muted px-2.5 py-1 text-xs font-semibold text-destructive">
        <Clock className="size-3.5" aria-hidden="true" /> {dueLabel(days)}
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        <Clock className="size-3.5" aria-hidden="true" /> {dueLabel(days)}
      </span>
    );
  }
  return <span className="inline-flex shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">รอทำ</span>;
}

function PendingSection() {
  const { data, isLoading } = useMyEvaluationAssignments();
  const items = data?.data ?? [];

  if (isLoading || items.length === 0) return null;

  const withDays = items.map((item) => ({ item, days: daysUntil(item.endDate) }));
  const todo = withDays.filter((x) => x.item.status !== "SUBMITTED").sort((a, b) => a.days - b.days);
  const done = withDays.filter((x) => x.item.status === "SUBMITTED");
  const total = items.length;
  const pct = Math.round((done.length / total) * 100);
  const nearest = todo[0];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-accent p-4 text-foreground ring-1 ring-border">
        <p className="text-sm text-muted-foreground">งานประเมินของฉัน</p>
        <p className="mt-1 text-xl font-bold">
          {todo.length > 0 ? `ต้องประเมินอีก ${todo.length} คน` : "ประเมินครบทุกคนแล้ว"}
        </p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-card"
          role="progressbar"
          aria-valuenow={done.length}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`ส่งแล้ว ${done.length} จาก ${total} คน`}
        >
          <div className="h-full rounded-full bg-[#0d9488]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          ส่งแล้ว {done.length} จาก {total} คน
          {nearest ? ` · ปิดเร็วสุด ${fmtDate(nearest.item.endDate)} (${dueLabel(nearest.days)})` : ""}
        </p>
      </div>

      {todo.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            <ListChecks className="size-4 text-[#0d9488]" aria-hidden="true" /> ต้องทำ ({todo.length})
          </h2>
          {todo.map(({ item, days }) => (
            <AssignmentRow key={item.responseId} item={item} days={days} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">ส่งแล้ว ({done.length})</h2>
          {done.map(({ item, days }) => (
            <AssignmentRow key={item.responseId} item={item} days={days} />
          ))}
        </section>
      )}
    </div>
  );
}

function AssignmentRow({ item, days }: { item: MyAssignment; days: number }) {
  return (
    <Link
      href={`/performance/campaigns/${item.campaignId}/participants/${item.participantId}`}
      className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm ring-1 ring-border/60 active:bg-muted"
    >
      <Avatar className="size-11">
        {item.employee.avatarUrl && <AvatarImage src={item.employee.avatarUrl} alt={item.employee.firstName} />}
        <AvatarFallback className="bg-primary/10 text-sm text-primary">
          {getInitials(item.employee.firstName, item.employee.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">
          {fullName(item.employee.firstName, item.employee.lastName)}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {RATER_LABEL[item.raterType] ?? item.raterType} · {item.campaignName}
        </p>
        <p className="text-sm text-muted-foreground">ปิดรอบ {fmtDate(item.endDate)}</p>
      </div>
      <StatusChip submitted={item.status === "SUBMITTED"} days={days} />
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function MyReviews() {
  const { data, isLoading, isError, refetch } = useReviews("me");
  const reviews = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={2} />;
  if (reviews.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="ยังไม่มีผลการประเมิน" description="ผลการประเมินจากหัวหน้างานจะแสดงที่นี่" />;
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </div>
  );
}
