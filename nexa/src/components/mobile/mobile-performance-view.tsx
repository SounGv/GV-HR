"use client";

import Link from "next/link";
import { ClipboardCheck, ChevronRight, ListChecks } from "lucide-react";

import { MobileScreen } from "./mobile-screen";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fullName, getInitials } from "@/lib/format";
import { useReviews } from "@/features/performance/hooks";
import { ReviewCard } from "@/features/performance/review-card";
import { useMyPendingResponses } from "@/features/campaign/hooks";
import { RATER_LABEL } from "@/features/campaign/labels";

/**
 * Lightweight mobile-first performance screen — my own review history plus
 * every evaluation task (self/peer/manager/upward) still owed a score,
 * instead of making phones fight the desktop tab bar (campaigns/9-box/
 * succession). Desktop keeps `PerformanceView` unchanged.
 */
export function MobilePerformanceView() {
  return (
    <MobileScreen title="ประเมินผล" backHref="/services" contentClassName="space-y-4 p-4">
      <PendingSection />
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">ผลประเมินของฉัน</h2>
        <MyReviews />
      </div>
    </MobileScreen>
  );
}

function PendingSection() {
  const { data, isLoading } = useMyPendingResponses();
  const items = data?.data ?? [];

  if (isLoading || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <ListChecks className="size-4 text-primary" /> รายการที่ต้องให้คะแนน ({items.length})
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.responseId}
            href={`/performance/campaigns/${item.campaignId}/participants/${item.participantId}`}
            className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm active:bg-muted"
          >
            <Avatar className="size-9">
              {item.employee.avatarUrl && (
                <AvatarImage src={item.employee.avatarUrl} alt={item.employee.firstName} />
              )}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(item.employee.firstName, item.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {fullName(item.employee.firstName, item.employee.lastName)}
              </p>
              <p className="text-xs text-muted-foreground">
                {RATER_LABEL[item.raterType] ?? item.raterType} · {item.campaignName} · {item.cycle}
              </p>
              {item.totalQuestions > 0 && (
                <p className="mt-0.5 text-xs text-primary">{item.totalQuestions} หัวข้อ · ยังไม่ได้ทำ</p>
              )}
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
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
