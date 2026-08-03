"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { fullName, getInitials } from "@/lib/format";
import { bandTone } from "./calc";
import type { PerformanceReview } from "./types";

const TONE_CLASS: Record<string, string> = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

export function ReviewCard({
  review,
  showEmployee,
  canEdit,
}: {
  review: PerformanceReview;
  showEmployee?: boolean;
  canEdit?: boolean;
}) {
  const tone = TONE_CLASS[bandTone(review.band)];

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/performance/${review.id}`} className="flex items-center gap-3">
          {showEmployee ? (
            <>
              <Avatar className="size-10">
                {review.employee.avatarUrl && (
                  <AvatarImage src={review.employee.avatarUrl} alt={review.employee.firstName} />
                )}
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {getInitials(review.employee.firstName, review.employee.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">
                  {fullName(review.employee.firstName, review.employee.lastName)}
                </p>
                <p className="text-xs text-muted-foreground">รอบ {review.cycle}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-medium text-foreground">รอบการประเมิน {review.cycle}</p>
              <p className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(
                  new Date(review.createdAt),
                )}
              </p>
            </div>
          )}
        </Link>

        <div className="flex items-center gap-2">
          <div className={cn("flex flex-col items-center rounded-2xl px-3.5 py-1.5", tone)}>
            <span className="text-2xl font-semibold leading-none tabular-nums">
              {review.overallScore.toFixed(1)}
            </span>
            <span className="text-[10px] font-medium opacity-80">{review.band} · /5.0</span>
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="แก้ไข"
              render={<Link href={`/performance/${review.id}/edit`} />}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {review.competencies.map((c) => (
          <div key={c.name} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-sm text-muted-foreground">{c.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    c.score >= 4 ? "bg-success" : c.score >= 3 ? "bg-primary" : "bg-warning",
                  )}
                  style={{ width: `${(c.score / 5) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-medium tabular-nums">{c.score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {(review.strengths || review.improvements || review.summary) && (
        <div className="space-y-2 border-t border-border pt-3 text-sm">
          {review.strengths && (
            <p>
              <span className="font-medium text-success">จุดแข็ง: </span>
              <span className="text-muted-foreground">{review.strengths}</span>
            </p>
          )}
          {review.improvements && (
            <p>
              <span className="font-medium text-warning">สิ่งที่ควรพัฒนา: </span>
              <span className="text-muted-foreground">{review.improvements}</span>
            </p>
          )}
          {review.summary && (
            <p>
              <span className="font-medium text-foreground">สรุป: </span>
              <span className="text-muted-foreground">{review.summary}</span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
