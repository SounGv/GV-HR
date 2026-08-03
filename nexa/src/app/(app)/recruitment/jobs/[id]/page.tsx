import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Pencil, Users } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CandidateStageBadge, CANDIDATE_STAGE_LABEL, JOB_STATUS_LABEL } from "@/features/recruitment/labels";
import { getJob, listCandidates } from "@/features/recruitment/service";
import { EMPLOYMENT_LABEL } from "@/features/employee/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "รายละเอียดตำแหน่งงาน" };

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("recruitment:read");
  const { id } = await params;

  const job = await getJob(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  const candidates = await listCandidates(session.companyId, { jobPostingId: id });
  const canEdit = can(session.perms, "recruitment:update");
  const stageStats = candidates.reduce(
    (acc, c) => {
      acc[c.stage] = (acc[c.stage] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "สรรหาพนักงาน", href: "/recruitment" }, { label: job.title }]}
        backHref="/recruitment"
        title={job.title}
        description={`${EMPLOYMENT_LABEL[job.employmentType as keyof typeof EMPLOYMENT_LABEL] ?? job.employmentType} · ${job.location ?? "ไม่ระบุสถานที่"}`}
        status={
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
              job.status === "OPEN" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {JOB_STATUS_LABEL[job.status]}
          </span>
        }
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" render={<Link href={`/recruitment/jobs/${job.id}/edit`} />}>
              <Pencil className="size-4" /> แก้ไข
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">รายละเอียดตำแหน่ง</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Briefcase} label="ประเภทการจ้าง" value={EMPLOYMENT_LABEL[job.employmentType as keyof typeof EMPLOYMENT_LABEL] ?? job.employmentType} />
            <InfoRow icon={Users} label="จำนวนที่รับ" value={`${job.openings} อัตรา`} />
            <InfoRow icon={MapPin} label="สถานที่" value={job.location ?? "—"} />
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">รายละเอียดงาน</p>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{job.description || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">สถานะผู้สมัคร</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <div className="text-xs text-muted-foreground">ผู้สมัครทั้งหมด</div>
              <div className="text-2xl font-semibold text-foreground">{candidates.length}</div>
            </div>
            {(["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"] as const).map((stage) => (
              <div key={stage} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">{CANDIDATE_STAGE_LABEL[stage]}</span>
                <span className="font-medium text-foreground">{stageStats[stage] ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ผู้สมัครในตำแหน่งนี้</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีผู้สมัครในตำแหน่งนี้</p>
          ) : (
            candidates.map((candidate) => (
              <div key={candidate.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/recruitment/candidates/${candidate.id}`} className="font-medium text-foreground hover:text-primary">
                    {candidate.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {candidate.email || "—"}
                    {candidate.phone ? ` · ${candidate.phone}` : ""}
                  </p>
                </div>
                <CandidateStageBadge stage={candidate.stage} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="size-4" />}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
