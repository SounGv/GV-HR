import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Plus, Target, TrendingUp, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { GoalStatusBadge, GOAL_TYPE_LABEL } from "@/features/kpi/labels";
import { rollupKeyResults } from "@/features/kpi/service";

export const metadata: Metadata = { title: "รายละเอียด KPI / เป้าหมาย" };

function progressPercent(current: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.round((current / target) * 100));
}

export default async function KpiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("kpi:read");
  const { id } = await params;

  const goal = await prisma.goal.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      cycle: true,
      unit: true,
      targetValue: true,
      currentValue: true,
      weight: true,
      status: true,
      dueDate: true,
      createdAt: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      keyResults: {
        where: { deletedAt: null },
        select: { id: true, title: true, unit: true, targetValue: true, currentValue: true, weight: true, status: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!goal) notFound();

  const employeeName = [goal.employee.firstName, goal.employee.lastName].filter(Boolean).join(" ");
  const rollup = rollupKeyResults(goal.keyResults);
  const progress = rollup ? rollup.percent : progressPercent(goal.currentValue, goal.targetValue);
  const effectiveStatus = rollup ? rollup.status : goal.status;
  const canCreateKeyResult = can(session.perms, "kpi:create") && goal.type === "OKR";
  const isOwner = goal.employee.id === session.employeeId;

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "KPI", href: "/kpi" }, { label: goal.title }]}
        backHref="/kpi"
        title={goal.title}
        description={`${GOAL_TYPE_LABEL[goal.type]} · ${goal.cycle}`}
        status={<GoalStatusBadge status={effectiveStatus} />}
        actions={
          <Link href="/kpi" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียด KPI / เป้าหมาย</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="เจ้าของเป้าหมาย" value={employeeName} />
            <InfoRow
              icon={Target}
              label="เป้าหมาย"
              value={rollup ? `${goal.keyResults.length} Key Results` : `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`}
            />
            <InfoRow icon={TrendingUp} label="ความก้าวหน้า" value={`${progress}%`} />
            <InfoRow icon={CalendarDays} label="ครบกำหนด" value={goal.dueDate ? formatDate(goal.dueDate) : "—"} />
            <InfoRow label="น้ำหนัก" value={`${goal.weight}`} />
            <InfoRow label="รอบ" value={goal.cycle} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> รายละเอียด
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{goal.description || "—"}</p>
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(goal.createdAt)}</p>
        </CardContent>
      </Card>

      {goal.type === "OKR" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Key Results</CardTitle>
            {canCreateKeyResult && (
              <Button size="sm" variant="outline" render={<Link href={`/kpi/new?parentGoalId=${goal.id}`} />}>
                <Plus className="size-4" /> เพิ่ม Key Result
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {goal.keyResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มี Key Result — เพิ่มตัวชี้วัดย่อยที่วัดผลได้เพื่อติดตามความคืบหน้าของ Objective นี้
              </p>
            ) : (
              goal.keyResults.map((kr) => {
                const krPct = progressPercent(kr.currentValue, kr.targetValue);
                return (
                  <div key={kr.id} className="space-y-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{kr.title}</span>
                      <div className="flex items-center gap-2">
                        <GoalStatusBadge status={kr.status} />
                        {isOwner && kr.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 gap-1 text-xs"
                            render={<Link href={`/kpi/${kr.id}/progress`} />}
                          >
                            <TrendingUp className="size-3" /> อัปเดต
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                      <span className="font-semibold text-foreground">{krPct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${kr.status === "AT_RISK" ? "bg-warning" : kr.status === "COMPLETED" ? "bg-success" : "bg-primary"}`}
                        style={{ width: `${krPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
