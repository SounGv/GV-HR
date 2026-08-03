import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, Printer, ReceiptText, UserRound } from "lucide-react";

import { requirePagePermission } from "@/lib/auth/page-guard";
import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, fullName } from "@/lib/format";
import { getPayslip } from "@/features/payroll/service";
import { PayrollStatusBadge } from "@/features/payroll/status-badge";
import type { PayrollLineItem } from "@/features/payroll/types";

export const metadata: Metadata = { title: "รายละเอียดสลิปเงินเดือน" };

export default async function PayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePagePermission("payroll:read");
  const { id } = await params;

  let record;
  try {
    record = await getPayslip(session.companyId, session, id);
  } catch {
    notFound();
  }

  const employeeName = fullName(record.employee.firstName, record.employee.lastName);
  const earnings = record.earnings as unknown as PayrollLineItem[];
  const deductions = record.deductions as unknown as PayrollLineItem[];

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "เงินเดือน", href: "/payroll" }, { label: record.periodLabel }]}
        backHref="/payroll"
        title={record.periodLabel}
        description={`${record.employee.employeeCode} · ${employeeName}`}
        status={<PayrollStatusBadge status={record.status} />}
        actions={
          <Button variant="outline" size="sm" render={<Link href={`/payslip/${record.id}`} target="_blank" />}>
            <Printer className="size-4" /> พิมพ์ / PDF
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดสลิปเงินเดือน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={CalendarDays} label="งวด" value={record.periodLabel} />
            <InfoRow
              icon={ReceiptText}
              label="วันที่จ่าย"
              value={record.paidAt ? new Date(record.paidAt).toLocaleDateString("th-TH") : "ยังไม่จ่าย"}
            />
          </div>

          <Section title="รายได้">
            {earnings.map((e, i) => (
              <Row key={i} label={e.label} value={e.amount} />
            ))}
            <Row label="รวมรายได้" value={record.gross} strong />
          </Section>

          <Section title="รายการหัก">
            {deductions.map((d, i) => (
              <Row key={i} label={d.label} value={-d.amount} />
            ))}
            <Row label="รวมรายการหัก" value={-record.totalDeductions} strong />
          </Section>

          <div className="flex items-start justify-between rounded-lg bg-primary/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <BadgeCheck className="size-4 text-primary" /> เงินเดือนสุทธิ
              </div>
              <p className="mt-1 text-xs text-muted-foreground">ยอดที่โอน/จ่ายจริงในรอบนี้</p>
            </div>
            <span className="text-lg font-semibold text-primary">{formatCurrency(record.net)}</span>
          </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{formatCurrency(value)}</span>
    </div>
  );
}
