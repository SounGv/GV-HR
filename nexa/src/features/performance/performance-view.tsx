"use client";

import Link from "next/link";
import { Plus, ClipboardCheck, Sparkles, Target, Scale, Grid3x3, Users } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { AiEvaluationView } from "@/features/ai/ai-evaluation-view";
import { CampaignView } from "@/features/campaign/campaign-view";
import { CalibrationView } from "@/features/calibration/calibration-view";
import { NineBoxView } from "@/features/calibration/nine-box-view";
import { SuccessionView } from "@/features/succession/succession-view";

import { ReviewCard } from "./review-card";
import { useReviews } from "./hooks";

export function PerformanceView() {
  const { can } = useAuth();
  const canReview = can("performance:create");
  const canAi = can("ai:read");
  const canCampaign = can("campaign:read");
  const canCalibration = can("calibration:read");
  const canSuccession = can("succession:read");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ผลประเมินของฉัน</TabsTrigger>
        {canReview && <TabsTrigger value="team">ประเมินทีม</TabsTrigger>}
        {canCampaign && (
          <TabsTrigger value="campaigns">
            <Target className="size-3.5" /> แคมเปญ
          </TabsTrigger>
        )}
        {canCalibration && (
          <TabsTrigger value="calibration">
            <Scale className="size-3.5" /> ปรับเทียบผล
          </TabsTrigger>
        )}
        {canCalibration && (
          <TabsTrigger value="nine-box">
            <Grid3x3 className="size-3.5" /> 9-Box
          </TabsTrigger>
        )}
        {canSuccession && (
          <TabsTrigger value="succession">
            <Users className="size-3.5" /> แผนสืบทอด
          </TabsTrigger>
        )}
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

      {canCampaign && (
        <TabsContent value="campaigns">
          <CampaignView />
        </TabsContent>
      )}

      {canCalibration && (
        <TabsContent value="calibration">
          <CalibrationView />
        </TabsContent>
      )}

      {canCalibration && (
        <TabsContent value="nine-box">
          <NineBoxView />
        </TabsContent>
      )}

      {canSuccession && (
        <TabsContent value="succession">
          <SuccessionView />
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
  const { user, can } = useAuth();
  const { data, isLoading, isError, refetch } = useReviews("me");
  const reviews = data?.data ?? [];
  const canViewHistory = can("campaign:read") && !!user.employee?.id;

  return (
    <div className="space-y-3">
      {canViewHistory && (
        <div className="flex justify-end">
          <Link
            href={`/employees/${user.employee!.id}/evaluation-history`}
            className="text-sm text-primary hover:underline"
          >
            ดูประวัติทั้งหมด
          </Link>
        </div>
      )}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="ยังไม่มีผลการประเมิน" description="ผลการประเมินจากหัวหน้างานจะแสดงที่นี่" />
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} />)
      )}
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
