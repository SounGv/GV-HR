import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText, Target, TrendingUp, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { GoalStatusBadge, GOAL_TYPE_LABEL } from "@/features/kpi/labels";

export const metadata: Metadata = { title: "รายละเอียด KPI / เป้าหมาย" };

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
    },
  });

  if (!goal) notFound();

  const employeeName = [goal.employee.firstName, goal.employee.lastName].filter(Boolean).join(" ");
  const progress = goal.targetValue <= 0 ? 0 : Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "KPI", href: "/kpi" }, { label: goal.title }]}
        backHref="/kpi"
        title={goal.title}
        description={`${GOAL_TYPE_LABEL[goal.type]} · ${goal.cycle}`}
        status={<GoalStatusBadge status={goal.status} />}
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
            <InfoRow icon={Target} label="เป้าหมาย" value={`${goal.currentValue} / ${goal.targetValue} ${goal.unit}`} />
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
