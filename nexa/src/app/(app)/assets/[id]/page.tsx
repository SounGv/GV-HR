import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, CalendarDays, FileText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AssetStatusBadge } from "@/features/asset/labels";

export const metadata: Metadata = { title: "รายละเอียดทรัพย์สิน" };

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("asset:read");
  const { id } = await params;

  const asset = await prisma.asset.findFirst({
    where: { id, companyId: session.companyId, deletedAt: null },
    select: {
      id: true,
      assetCode: true,
      name: true,
      category: true,
      serialNumber: true,
      status: true,
      assignedAt: true,
      purchaseDate: true,
      purchasePrice: true,
      note: true,
      createdAt: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!asset) notFound();

  const ownerName = asset.assignedTo ? [asset.assignedTo.firstName, asset.assignedTo.lastName].filter(Boolean).join(" ") : "—";

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "ทรัพย์สิน", href: "/assets" }, { label: asset.name }]}
        backHref="/assets"
        title={asset.name}
        description={`${asset.assetCode} · ${asset.category}`}
        status={<AssetStatusBadge status={asset.status} />}
        actions={
          <Link href="/assets" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดทรัพย์สิน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={Boxes} label="รหัสทรัพย์สิน" value={asset.assetCode} />
            <InfoRow label="หมวดหมู่" value={asset.category} />
            <InfoRow label="Serial Number" value={asset.serialNumber || "—"} />
            <InfoRow icon={UserRound} label="ผู้ถือครอง" value={ownerName} />
            <InfoRow icon={CalendarDays} label="วันที่ซื้อ" value={asset.purchaseDate ? formatDate(asset.purchaseDate) : "—"} />
            <InfoRow icon={FileText} label="ราคา" value={asset.purchasePrice != null ? formatCurrency(asset.purchasePrice) : "—"} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> หมายเหตุ
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{asset.note || "—"}</p>
          </div>
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(asset.createdAt)}</p>
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
