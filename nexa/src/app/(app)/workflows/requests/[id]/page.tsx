import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { RequestStatusBadge } from "@/features/workflow/labels";
import type { RequestStatus } from "@/features/workflow/types";

export const metadata: Metadata = { title: "รายละเอียดคำขออนุมัติ" };

export default async function WorkflowRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("workflow:read");
  const { id } = await params;

  const request = await prisma.approvalRequest.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      workflowName: true,
      requesterName: true,
      title: true,
      detail: true,
      amount: true,
      steps: true,
      currentStep: true,
      status: true,
      createdAt: true,
    },
  });

  if (!request) notFound();

  const steps = (request.steps as Array<{ name?: string; status?: string; decidedByName?: string; note?: string }>) ?? [];
  const status = request.status as RequestStatus;

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "เวิร์กโฟลว์อนุมัติ", href: "/workflows" }, { label: request.title }]}
        backHref="/workflows"
        title={request.title}
        description={request.workflowName}
        status={<RequestStatusBadge status={status} />}
        actions={
          <Link href="/workflows" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดคำขออนุมัติ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="ผู้ส่งคำขอ" value={request.requesterName} />
            <InfoRow label="สถานะปัจจุบัน" value={request.status} />
            <InfoRow label="ขั้นตอนปัจจุบัน" value={`${(request.currentStep ?? 0) + 1}/${steps.length || 1}`} />
            <InfoRow label="จำนวนเงิน" value={request.amount != null ? formatCurrency(Number(request.amount)) : "—"} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> รายละเอียด
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{request.detail || "—"}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">สถานะแต่ละขั้นตอน</p>
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีข้อมูลขั้นตอน</p>
            ) : (
              steps.map((step, index) => (
                <div key={`${step.name}-${index}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{step.name || `ขั้นตอนที่ ${index + 1}`}</span>
                    <span className="text-muted-foreground">{step.status || "PENDING"}</span>
                  </div>
                  {step.decidedByName && <p className="mt-1 text-xs text-muted-foreground">อนุมัติโดย {step.decidedByName}</p>}
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(request.createdAt)}</p>
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
