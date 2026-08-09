import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Mail, Pencil, Phone, StickyNote, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CandidateStageBadge, CANDIDATE_STAGE_LABEL } from "@/features/recruitment/labels";
import { getCandidate } from "@/features/recruitment/service";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "รายละเอียดผู้สมัคร" };

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("recruitment:read");
  const { id } = await params;

  const candidate = await getCandidate(session.companyId, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const canEdit = can(session.perms, "recruitment:update");

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "สรรหาพนักงาน", href: "/recruitment" }, { label: candidate.name }]}
        backHref="/recruitment"
        title={candidate.name}
        description={candidate.jobPosting.title}
        status={<CandidateStageBadge stage={candidate.stage} />}
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" render={<Link href={`/recruitment/candidates/${candidate.id}/edit`} />}>
              <Pencil className="size-4" /> แก้ไข
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ข้อมูลผู้สมัคร</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="ชื่อ" value={candidate.name} />
            <InfoRow icon={Mail} label="อีเมล" value={candidate.email || "—"} />
            <InfoRow icon={Phone} label="โทร" value={candidate.phone || "—"} />
            <InfoRow label="สถานะ" value={CANDIDATE_STAGE_LABEL[candidate.stage]} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <StickyNote className="size-4" /> หมายเหตุ
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {candidate.note || "ไม่มีหมายเหตุ"}
            </p>
          </div>
          {candidate.resumeUrl && (
            <a
              href={candidate.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FileText className="size-4" /> ดูเรซูเม่
            </a>
          )}
          <p className="text-xs text-muted-foreground">สมัครเมื่อ {formatDate(candidate.createdAt)}</p>
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
