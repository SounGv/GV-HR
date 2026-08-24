"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Coins, FileText, Landmark, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, formatCurrency, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { LoanStatusBadge } from "./labels";
import { useLoan, useRepayLoan } from "./hooks";

export function LoanDetailView({ loanId }: { loanId: string }) {
  const { can } = useAuth();
  const canApprove = can("expense:approve");
  const { data, isLoading, isError } = useLoan(loanId);
  const repayMut = useRepayLoan();
  const [repayOpen, setRepayOpen] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;
  if (isError || !data?.data) return <p className="text-sm text-destructive">ไม่พบข้อมูล</p>;
  const loan = data.data;
  const employeeName = fullName(loan.employee.firstName, loan.employee.lastName);
  const outstanding = loan.amount - loan.repaidAmount;

  async function submitRepay() {
    const amount = Number(repayAmount);
    if (!amount || amount <= 0) {
      toast.error("กรุณาระบุจำนวนเงิน");
      return;
    }
    try {
      await repayMut.mutateAsync({ id: loan.id, amount });
      toast.success("บันทึกการผ่อนชำระเรียบร้อย");
      setRepayOpen(false);
      setRepayAmount("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeaderBar
        breadcrumbs={[{ label: "สวัสดิการ", href: "/benefits" }, { label: "กู้เงินบริษัท", href: "/benefits/loans" }, { label: employeeName }]}
        backHref="/benefits/loans"
        title={`คำขอกู้เงินบริษัท — ${employeeName}`}
        description={`${loan.employee.employeeCode} · ปี ${loan.year}`}
        status={<LoanStatusBadge status={loan.status} />}
        actions={
          <Link href="/benefits/loans" className="text-sm text-muted-foreground hover:text-foreground">
            กลับรายการ
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดคำขอกู้เงิน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoRow icon={UserRound} label="พนักงาน" value={employeeName} />
            <InfoRow icon={CalendarDays} label="วันที่ยื่น" value={formatDate(loan.createdAt)} />
            <InfoRow icon={Coins} label="จำนวนเงินกู้" value={formatCurrency(loan.amount)} />
            <InfoRow icon={Landmark} label="เงินเดือน ณ วันที่กู้" value={formatCurrency(loan.salarySnapshot)} />
            <InfoRow label="จำนวนงวดผ่อน" value={`${loan.installmentCount} งวด`} />
            <InfoRow label="บัญชีรับเงิน" value={loan.bankName ? `${loan.bankName} · ${loan.bankAccountNo ?? "-"}` : "-"} />
          </div>

          {loan.status === "PAID" && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">ยอดผ่อนชำระ</p>
                {canApprove && (
                  <Button size="sm" variant="outline" onClick={() => setRepayOpen(true)}>
                    บันทึกการผ่อนชำระ
                  </Button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <Stat label="ยอดกู้" value={formatCurrency(loan.amount)} />
                <Stat label="ผ่อนแล้ว" value={formatCurrency(loan.repaidAmount)} />
                <Stat label="คงค้าง" value={formatCurrency(outstanding)} highlight />
              </div>
            </div>
          )}

          {loan.reason && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-4" /> เหตุผลการกู้
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{loan.reason}</p>
            </div>
          )}

          {loan.attachmentUrl && (
            <a href={loan.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <FileText className="size-4" /> ดูเอกสารประกอบ
            </a>
          )}

          {loan.decisionNote && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">หมายเหตุการพิจารณา</p>
              <p className="mt-2 text-sm text-muted-foreground">{loan.decisionNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>บันทึกการผ่อนชำระ</DialogTitle>
            <DialogDescription>คงค้างปัจจุบัน {formatCurrency(outstanding)} บาท</DialogDescription>
          </DialogHeader>
          <Input type="number" step="0.01" min="0" placeholder="จำนวนเงินที่ผ่อนชำระ" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} />
          <Button className="w-full" onClick={submitRepay} disabled={repayMut.isPending}>
            บันทึก
          </Button>
        </DialogContent>
      </Dialog>
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

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-card p-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={highlight ? "font-semibold text-primary" : "font-medium text-foreground"}>{value}</p>
    </div>
  );
}
