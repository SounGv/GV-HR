import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FileText, Pencil, Star, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, fullName } from "@/lib/format";
import { getReview } from "@/features/performance/service";
import { bandTone } from "@/features/performance/calc";

export const metadata: Metadata = { title: "รายละเอียดผลการประเมิน" };

export default async function PerformanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("performance:read");
  const { id } = await params;

  const review = await getReview(session.companyId, session, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const canEdit = can(session.perms, "performance:update");

  const employeeName = fullName(review.employee.firstName, review.employee.lastName);
  const tone = bandTone(review.band);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมินผล", href: "/performance" }, { label: review.cycle }]}
        backHref="/performance"
        title={review.cycle}
        description={employeeName}
        status={
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${tone === "success" ? "bg-success/10 text-success" : tone === "info" ? "bg-info/10 text-info" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
            <Star className="size-3" /> {review.band}
          </span>
        }
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" render={<Link href={`/performance/${review.id}/edit`} />}>
              <Pencil className="size-4" /> แก้ไข
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดผลการประเมิน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={ClipboardCheck} label="คะแนนรวม" value={review.overallScore.toFixed(1)} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> สรุป
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{review.summary || "—"}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">สมรรถนะ</p>
            {(review.competencies as Array<{ name: string; score: number }>).map((c) => (
              <div key={c.name} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">{c.score.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(review.createdAt)}</p>
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
