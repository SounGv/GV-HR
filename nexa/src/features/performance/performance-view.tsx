"use client";

import Link from "next/link";
import {
  Plus,
  ClipboardCheck,
  ClipboardList,
  Target,
  CalendarClock,
  Sparkles,
  Scale,
  Grid3x3,
  Users,
  Building2,
  BarChart3,
  Rocket,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { CampaignView } from "@/features/campaign/campaign-view";
import { CalibrationView } from "@/features/calibration/calibration-view";
import { NineBoxView } from "@/features/calibration/nine-box-view";
import { SuccessionView } from "@/features/succession/succession-view";
import { TemplateListView } from "@/features/evaluation-template/template-list-view";
import { ScheduleTemplateListView } from "@/features/evaluation-schedule/schedule-list-view";
import { CompetencyView } from "@/features/competency/competency-view";
import { DevelopmentPlanView } from "@/features/development-plan/development-plan-view";

import { ReviewCard } from "./review-card";
import { DepartmentSummaryView } from "./department-summary-view";
import { useReviews } from "./hooks";

/**
 * Three top-level tabs only — 9-Box/Calibration/Succession/AI/schedules/
 * competencies used to all sit in one flat row, which buried the two things
 * most people actually need (my own results, and HR's campaign setup) among
 * rarely-used analytics tools. Everything HR-only now nests under
 * "จัดการรอบประเมิน" / "วิเคราะห์บุคลากร" instead of competing for top billing.
 */
export function PerformanceView() {
  const { can } = useAuth();
  const canReview = can("performance:create");
  const canHrLevel = can("performance:approve");
  const canCampaign = can("campaign:read");
  const canCalibration = can("calibration:read");
  const canSuccession = can("succession:read");
  const canAnalytics = canHrLevel || canCalibration || canSuccession;

  return (
    <Tabs defaultValue="tasks" className="space-y-4">
      <TabsList>
        <TabsTrigger value="tasks">
          <ClipboardCheck className="size-3.5" /> งานประเมิน
        </TabsTrigger>
        {canCampaign && (
          <TabsTrigger value="manage">
            <CalendarClock className="size-3.5" /> จัดการรอบประเมิน
          </TabsTrigger>
        )}
        {canAnalytics && (
          <TabsTrigger value="analytics">
            <BarChart3 className="size-3.5" /> วิเคราะห์บุคลากร
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="tasks">
        <EvaluationTasksTab canReview={canReview} />
      </TabsContent>

      {canCampaign && (
        <TabsContent value="manage">
          <ManageCampaignsTab />
        </TabsContent>
      )}

      {canAnalytics && (
        <TabsContent value="analytics">
          <AnalyticsTab canHrLevel={canHrLevel} canCalibration={canCalibration} canSuccession={canSuccession} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function EvaluationTasksTab({ canReview }: { canReview: boolean }) {
  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ผลประเมินของฉัน</TabsTrigger>
        {canReview && <TabsTrigger value="team">ประเมินทีม</TabsTrigger>}
        <TabsTrigger value="idp">
          <Rocket className="size-3.5" /> แผนพัฒนา (IDP)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="me">
        <MyReviews />
      </TabsContent>
      {canReview && (
        <TabsContent value="team">
          <TeamReviews />
        </TabsContent>
      )}
      <TabsContent value="idp">
        <DevelopmentPlanView />
      </TabsContent>
    </Tabs>
  );
}

function ManageCampaignsTab() {
  return (
    <Tabs defaultValue="campaigns" className="space-y-4">
      <TabsList>
        <TabsTrigger value="templates">
          <ClipboardList className="size-3.5" /> แบบประเมิน
        </TabsTrigger>
        <TabsTrigger value="campaigns">
          <Target className="size-3.5" /> รอบประเมิน
        </TabsTrigger>
        <TabsTrigger value="schedules">
          <CalendarClock className="size-3.5" /> ตารางประเมินอัตโนมัติ
        </TabsTrigger>
        <TabsTrigger value="competencies">
          <Sparkles className="size-3.5" /> คลังสมรรถนะเดิม
        </TabsTrigger>
      </TabsList>
      <TabsContent value="templates">
        <TemplateListView />
      </TabsContent>
      <TabsContent value="campaigns">
        <CampaignView />
      </TabsContent>
      <TabsContent value="schedules">
        <ScheduleTemplateListView />
      </TabsContent>
      <TabsContent value="competencies">
        <CompetencyView />
      </TabsContent>
    </Tabs>
  );
}

function AnalyticsTab({
  canHrLevel,
  canCalibration,
  canSuccession,
}: {
  canHrLevel: boolean;
  canCalibration: boolean;
  canSuccession: boolean;
}) {
  const first = canHrLevel ? "department-summary" : canCalibration ? "calibration" : "succession";

  return (
    <Tabs defaultValue={first} className="space-y-4">
      <TabsList>
        {canHrLevel && (
          <TabsTrigger value="department-summary">
            <Building2 className="size-3.5" /> สรุปแผนก
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
      </TabsList>
      {canHrLevel && (
        <TabsContent value="department-summary">
          <DepartmentSummaryView />
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
