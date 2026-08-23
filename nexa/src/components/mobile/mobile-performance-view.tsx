"use client";

import Link from "next/link";
import { ClipboardCheck, ChevronRight, ListChecks } from "lucide-react";

import { MobileScreen } from "./mobile-screen";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { fullName, getInitials } from "@/lib/format";
import { useReviews } from "@/features/performance/hooks";
import { ReviewCard } from "@/features/performance/review-card";
import { useMyEvaluationAssignments } from "@/features/campaign/hooks";
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
    <MobileScreen title="ประเมินผล" backHref="/services" contentClassName="space-y-4 p-4">
      <PendingSection />
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">ผลประเมินของฉัน</h2>
        <MyReviews />
      </div>
    </MobileScreen>
  );
}

function PendingSection() {
  const { data, isLoading } = useMyEvaluationAssignments();
  const items = data?.data ?? [];

  if (isLoading || items.length === 0) return null;

  const pendingCount = items.filter((i) => i.status === "PENDING").length;

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        <ListChecks className="size-4 text-primary" /> รายการที่ให้ประเมิน ({items.length})
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.responseId}
            href={`/performance/campaigns/${item.campaignId}/participants/${item.participantId}`}
            className="flex items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm active:bg-muted"
          >
            <Avatar className="size-11">
              {item.employee.avatarUrl && (
                <AvatarImage src={item.employee.avatarUrl} alt={item.employee.firstName} />
              )}
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {getInitials(item.employee.firstName, item.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">
                {fullName(item.employee.firstName, item.employee.lastName)}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {RATER_LABEL[item.raterType] ?? item.raterType} · {item.campaignName} · {item.cycle}
              </p>
              <p className="text-sm text-muted-foreground">
                {fmtDate(item.startDate)} – {fmtDate(item.endDate)}
              </p>
            </div>
            <Badge variant={item.status === "SUBMITTED" ? "secondary" : "default"}>
              {item.status === "SUBMITTED" ? "ทำแล้ว" : "รอทำ"}
            </Badge>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
      {pendingCount === 0 && (
        <p className="text-center text-xs text-muted-foreground">ทำครบทุกรายการแล้ว</p>
      )}
    </div>
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
