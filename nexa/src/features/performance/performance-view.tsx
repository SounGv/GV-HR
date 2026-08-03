"use client";

import Link from "next/link";
import { Plus, ClipboardCheck, Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { AiEvaluationView } from "@/features/ai/ai-evaluation-view";

import { ReviewCard } from "./review-card";
import { useReviews } from "./hooks";

export function PerformanceView() {
  const { can } = useAuth();
  const canReview = can("performance:create");
  const canAi = can("ai:read");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ผลประเมินของฉัน</TabsTrigger>
        {canReview && <TabsTrigger value="team">ประเมินทีม</TabsTrigger>}
        {canAi && (
          <TabsTrigger value="ai">
            <Sparkles className="size-3.5" /> แบบประเมิน AI
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="me">
        <MyReviews />
      </TabsContent>

      {canReview && (
        <TabsContent value="team">
          <TeamReviews />
        </TabsContent>
      )}

      {canAi && (
        <TabsContent value="ai">
          <AiEvaluationView />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyReviews() {
  const { data, isLoading, isError, refetch } = useReviews("me");
  const reviews = data?.data ?? [];

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
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

function TeamReviews() {
  const { data, isLoading, isError, refetch } = useReviews("team");
  const reviews = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ผลประเมินของทีม</h2>
        <Button render={<Link href="/performance/new" />}>
          <Plus className="size-4" /> สร้างการประเมิน
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="ยังไม่มีการประเมิน" description="เริ่มต้นด้วยการประเมินสมาชิกในทีม" />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} showEmployee canEdit />
          ))}
        </div>
      )}
    </div>
  );
}
