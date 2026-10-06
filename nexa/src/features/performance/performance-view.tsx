"use client";

import Link from "next/link";
import {
  Plus,
  ClipboardCheck,
  CalendarClock,
  Scale,
  Grid3x3,
  Users,
  Building2,
  BarChart3,
  Rocket,
  ListChecks,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { CalibrationView } from "@/features/calibration/calibration-view";
import { NineBoxView } from "@/features/calibration/nine-box-view";
import { SuccessionView } from "@/features/succession/succession-view";
import { DevelopmentPlanView } from "@/features/development-plan/development-plan-view";

import { ReviewCard } from "./review-card";
import { DepartmentSummaryView } from "./department-summary-view";
import { EvaluationDashboardView } from "@/features/campaign/evaluation-dashboard-view";
import { useReviews } from "./hooks";

/**
 * One flat row of top-level tabs, no tabs-nested-in-tabs — the previous
 * version buried "งานที่ต้องประเมิน"/"ผลประเมิน"/IDP three levels deep inside
 * an outer "งานประเมิน" tab that itself sat beside "จัดการรอบประเมิน"/
 * "วิเคราะห์บุคลากร", so every regular employee had to learn a nested-tabs
 * pattern just to reach their own task list. Each of those three is now its
 * own top-level tab instead. HR-only tools stay grouped under "จัดการรอบ
 * ประเมิน" / "วิเคราะห์บุคลากร" (still internally tabbed — that grouping is
 * coherent, all analytics, all rarely used by non-HR, and never shown to
 * anyone without the relevant permission at all).
 */
export function PerformanceView() {
  const { can } = useAuth();
  const canReview = can("performance:create");
  const canHrLevel = can("performance:approve");
  const canCampaign = can("campaign:manage");
  const canCalibration = can("calibration:read");
  const canSuccession = can("succession:read");
  const canAnalytics = canHrLevel || canCalibration || canSuccession;

  return (
    <Tabs defaultValue="assignments" className="space-y-4">
      <TabsList>
        <TabsTrigger value="assignments">
          <ListChecks className="size-3.5" /> งานที่ต้องประเมิน
        </TabsTrigger>
        <TabsTrigger value="results">
          <ClipboardCheck className="size-3.5" /> ผลประเมิน
        </TabsTrigger>
        <TabsTrigger value="idp">
          <Rocket className="size-3.5" /> แผนพัฒนา (IDP)
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

      <TabsContent value="assignments">
        <MovedNotice
          title="งานที่ต้องประเมิน ย้ายไปที่เมนูใหม่แล้ว"
          description="รอบประเมินใหม่ส่งข้อความเข้ากล่องข้อความและ LINE แล้วทำแบบประเมินได้จากหน้า “งานประเมินของฉัน”"
          href="/appraisal/tasks"
          label="ไปที่งานประเมินของฉัน"
        />
      </TabsContent>

      <TabsContent value="results">
        <ResultsTab canReview={canReview} />
      </TabsContent>

      <TabsContent value="idp">
        <DevelopmentPlanView />
      </TabsContent>

      {canCampaign && (
        <TabsContent value="manage">
          <MovedNotice
            title="การจัดการรอบประเมิน ย้ายไปที่เมนูใหม่แล้ว"
            description="สร้างแบบประเมิน สร้างรอบ เลือกคน จับคู่ผู้ประเมิน และดูความคืบหน้า ได้ที่เมนูประเมินใหม่"
            href="/appraisal"
            label="ไปที่ภาพรวมการประเมิน"
          />
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

/** My own results, plus my team's underneath (if I manage anyone) — two
 * stacked sections on one tab instead of another nested tab row, since
 * they're both just "results to look at," not separate workflows. */
function ResultsTab({ canReview }: { canReview: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">ผลประเมินของฉัน</h2>
        <MyReviews />
      </div>
      {canReview && (
        <div className="border-t border-border pt-6">
          <TeamReviews />
        </div>
      )}
    </div>
  );
}

/** The old round/assignment screens were replaced by the new evaluation menu; this points people there. */
function MovedNotice({ title, description, href, label }: { title: string; description: string; href: string; label: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button className="h-11 md:h-9" render={<Link href={href} />}>
        {label}
      </Button>
    </div>
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
  const first = canHrLevel ? "evaluation-dashboard" : canCalibration ? "calibration" : "succession";

  return (
    <Tabs defaultValue={first} className="space-y-4">
      <TabsList>
        {canHrLevel && (
          <TabsTrigger value="evaluation-dashboard">
            <BarChart3 className="size-3.5" /> Dashboard ผลประเมิน
          </TabsTrigger>
        )}
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
        <TabsContent value="evaluation-dashboard">
          <EvaluationDashboardView />
        </TabsContent>
      )}
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
        {/* Points at the campaign/template system, not the legacy
         * single-review /performance/new flow — that page always shows every
         * configured Competency with no way to pick topics per review (the
         * exact complaint this replaces), and has only ever collected 2 test
         * records. Not deleted (its data/route still exist), just no longer
         * the discoverable "create an evaluation" entry point. */}
        <Button render={<Link href="/appraisal/rounds" />}>
          <Plus className="size-4" /> สร้างรอบประเมิน
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
