import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Sparkles, Target, Info } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { can } from "@/lib/auth/rbac";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getCampaign } from "@/features/campaign/service";
import { ParticipantList } from "@/features/campaign/participant-list";
import { AddParticipantsDialog } from "@/features/campaign/add-participants-dialog";
import { CampaignStatusActions } from "@/features/campaign/campaign-status-actions";
import { TemplateFormRenderer } from "@/features/evaluation-template/template-renderer";

export const metadata: Metadata = { title: "รายละเอียดแคมเปญ" };

const STATUS_LABEL: Record<string, string> = { DRAFT: "ฉบับร่าง", ACTIVE: "กำลังดำเนินการ", CLOSED: "ปิดแล้ว" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("campaign:read");
  const { id } = await params;

  const campaign = await getCampaign(session.companyId, id, session).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const canManage = can(session.perms, "campaign:update");

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมินผล", href: "/performance" }, { label: campaign.name }]}
        backHref="/performance"
        title={campaign.name}
        description={`${campaign.cycle} · ${formatDate(campaign.startDate)} - ${formatDate(campaign.endDate)}`}
        status={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {STATUS_LABEL[campaign.status]}
          </span>
        }
        actions={
          canManage ? (
            <>
              {campaign.status === "DRAFT" && (
                <Button variant="outline" size="sm" render={<Link href={`/performance/campaigns/${campaign.id}/edit`} />}>
                  <Pencil className="size-4" /> แก้ไข
                </Button>
              )}
              <CampaignStatusActions
                campaignId={campaign.id}
                status={campaign.status}
                participantCount={campaign.participantCount}
              />
            </>
          ) : undefined
        }
      />

      {canManage && campaign.status === "DRAFT" && (
        <Card className="gap-2 border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <Info className="size-4" /> แคมเปญนี้ยังเป็นฉบับร่าง
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.participantCount === 0
              ? "ยังไม่มีผู้เข้าร่วม — เลื่อนลงไปกด \"เพิ่มผู้เข้าร่วม\" เพื่อเลือกคนที่จะประเมิน"
              : "ผู้ประเมินยังไม่เห็นงานหรือได้รับการแจ้งเตือนใดๆ จนกว่าจะกด \"เปิดใช้งานแคมเปญ\" ที่มุมขวาบน"}
          </p>
        </Card>
      )}

      {campaign.aiGenerated && campaign.aiRationale && (
        <Card className="gap-2 border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" /> ออกแบบโดย AI
          </div>
          <p className="text-sm text-muted-foreground">{campaign.aiRationale}</p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4" /> {campaign.templateSnapshot ? `แบบประเมิน: ${campaign.templateSnapshot.name}` : "สมรรถนะที่ใช้ประเมิน"}
          </CardTitle>
        </CardHeader>
        <CardContent className={campaign.templateSnapshot ? undefined : "space-y-1.5"}>
          {campaign.templateSnapshot ? (
            <TemplateFormRenderer sections={campaign.templateSnapshot.sections} mode="preview" />
          ) : (
            campaign.competencies.map((c) => (
              <div key={c.competencyId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-muted-foreground">น้ำหนัก {c.weight}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">ผู้เข้าร่วม ({campaign.participantCount})</h2>
          {canManage && (
            <AddParticipantsDialog
              campaignId={campaign.id}
              existingEmployeeIds={campaign.participants.map((p) => p.employee.id)}
            />
          )}
        </div>
        <ParticipantList
          campaignId={campaign.id}
          raterTypes={campaign.raterTypes}
          participants={campaign.participants.map((p) => ({
            id: p.id,
            overallScore: p.overallScore,
            band: p.band,
            finalizedAt: p.finalizedAt?.toISOString() ?? null,
            employee: p.employee,
            responses: p.responses.map((r) => ({
              raterType: r.raterType,
              status: r.status,
              submittedAt: r.submittedAt?.toISOString() ?? null,
            })),
          }))}
        />
      </div>
    </div>
  );
}
