"use client";

import Link from "next/link";
import { Stethoscope, Landmark } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { formatCurrency, formatDate } from "@/lib/format";
import { useExpenses } from "@/features/expense/hooks";
import { ExpenseStatusBadge } from "@/features/expense/labels";
import { useLoans } from "@/features/company-loan/hooks";
import { LoanStatusBadge } from "@/features/company-loan/labels";

/** "ประวัติสวัสดิการของฉัน" — every medical claim + loan request the
 * employee has ever submitted, combined in one read-only view. */
export function BenefitsHistoryView() {
  const { data: expenseData, isLoading: expenseLoading, isError: expenseError, refetch: refetchExpense } = useExpenses("me");
  const { data: loanData, isLoading: loanLoading, isError: loanError, refetch: refetchLoan } = useLoans("me");

  const medicalClaims = (expenseData?.data ?? []).filter((c) => c.category === "medical");
  const loans = loanData?.data ?? [];
  const isLoading = expenseLoading || loanLoading;
  const isError = expenseError || loanError;

  if (isError) return <ErrorState onRetry={() => { refetchExpense(); refetchLoan(); }} />;
  if (isLoading) return <TableLoadingState rows={5} />;

  if (medicalClaims.length === 0 && loans.length === 0) {
    return <EmptyState icon={Stethoscope} title="ยังไม่มีประวัติสวัสดิการ" description="รายการเบิกค่ารักษาพยาบาลและกู้เงินบริษัทจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Stethoscope className="size-4" /> ค่ารักษาพยาบาล
        </h2>
        {medicalClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
        ) : (
          <div className="space-y-2">
            {medicalClaims.map((c) => (
              <Link key={c.id} href={`/expenses/${c.id}`}>
                <Card className="flex-row items-center justify-between gap-3 p-3.5 transition hover:border-primary/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.title}</span>
                      <ExpenseStatusBadge status={c.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(c.expenseDate)} · {formatCurrency(c.amount)}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Landmark className="size-4" /> กู้เงินบริษัท
        </h2>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
        ) : (
          <div className="space-y-2">
            {loans.map((l) => (
              <Link key={l.id} href={`/benefits/loans/${l.id}`}>
                <Card className="flex-row items-center justify-between gap-3 p-3.5 transition hover:border-primary/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">คำขอกู้เงินบริษัท {l.year}</span>
                      <LoanStatusBadge status={l.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(l.createdAt)} · {formatCurrency(l.amount)} · ผ่อน {l.installmentCount} งวด
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
