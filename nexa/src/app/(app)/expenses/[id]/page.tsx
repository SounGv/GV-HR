import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Coins, FileText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { AppError } from "@/lib/api/errors";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, fullName } from "@/lib/format";
import { getExpense } from "@/features/expense/service";
import { EXPENSE_CATEGORY_LABEL, ExpenseStatusBadge } from "@/features/expense/labels";

export const metadata: Metadata = { title: "รายละเอียดรายการเบิกจ่าย" };

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("expense:read");
  const { id } = await params;

  const claim = await getExpense(session.companyId, session, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });

  const employeeName = fullName(claim.employee.firstName, claim.employee.lastName);

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "เบิกจ่าย", href: "/expenses" }, { label: claim.title }]}
        backHref="/expenses"
        title={claim.title}
        description={`${claim.employee.employeeCode} · ${EXPENSE_CATEGORY_LABEL[claim.category]}`}
        status={<ExpenseStatusBadge status={claim.status} />}
        actions={
          <Link href="/expenses" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดรายการเบิกจ่าย</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={CalendarDays} label="วันที่เบิก" value={formatDate(claim.expenseDate)} />
            <InfoRow icon={Coins} label="จำนวน" value={formatCurrency(Number(claim.amount))} />
            <InfoRow label="หมวดหมู่" value={EXPENSE_CATEGORY_LABEL[claim.category]} />
            {claim.hospitalName && <InfoRow label="โรงพยาบาล / คลินิก" value={claim.hospitalName} />}
            {claim.sickLeaveRequestId && (
              <InfoRow
                label="ใบลาป่วยที่อ้างอิง"
                value={
                  <Link href={`/leave/${claim.sickLeaveRequestId}`} className="text-primary hover:underline">
                    ดูใบลาป่วย
                  </Link>
                }
              />
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="size-4" /> รายละเอียด
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{claim.description || "—"}</p>
          </div>
          {claim.receiptUrl && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-2 text-sm font-medium text-foreground">รูปใบเสร็จ</p>
              <a href={claim.receiptUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={claim.receiptUrl}
                  alt="ใบเสร็จ"
                  className="max-h-64 rounded-md border border-border object-contain"
                />
              </a>
            </div>
          )}
          {claim.decisionNote && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">หมายเหตุการพิจารณา</p>
              <p className="mt-2 text-sm text-muted-foreground">{claim.decisionNote}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">สร้างเมื่อ {formatDate(claim.createdAt)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
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
