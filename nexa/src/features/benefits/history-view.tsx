"use client";

import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import { Stethoscope, Landmark } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { formatCurrency, formatDate } from "@/lib/format";
import { useExpenses } from "@/features/expense/hooks";
import { ExpenseStatusBadge } from "@/features/expense/labels";
import { useLoans } from "@/features/company-loan/hooks";
import { LoanStatusBadge } from "@/features/company-loan/labels";

/** "ประวัติสวัสดิการของฉัน" — every medical claim + loan request the
 * employee has ever submitted, combined in one read-only view. */
export function BenefitsHistoryView() {
  const hasEmployee = !!useAuth().user.employee;
  const { data: expenseData, isLoading: expenseLoading, isError: expenseError, error: expenseErr, refetch: refetchExpense } = useExpenses("me");
  const { data: loanData, isLoading: loanLoading, isError: loanError, error: loanErr, refetch: refetchLoan } = useLoans("me");

  const medicalClaims = (expenseData?.data ?? []).filter((c) => c.category === "medical");
  const loans = loanData?.data ?? [];
  const isLoading = expenseLoading || loanLoading;
  const isError = expenseError || loanError;

  if (!hasEmployee) return <NoEmployeeState />;
  if (isError) return <ErrorState error={expenseErr ?? loanErr} onRetry={() => { refetchExpense(); refetchLoan(); }} />;
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead className="w-full">เรื่อง</TableHead>
                <TableHead className="text-right">จำนวนเงิน</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicalClaims.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums">{formatDate(c.expenseDate)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Link href={`/expenses/${c.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                      {c.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.amount)}</TableCell>
                  <TableCell className="text-center">
                    <ExpenseStatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Landmark className="size-4" /> กู้เงินบริษัท
        </h2>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีรายการ</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่ยื่น</TableHead>
                <TableHead className="w-full">คำขอ</TableHead>
                <TableHead className="text-right">วงเงินกู้</TableHead>
                <TableHead className="text-center">งวด</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tabular-nums">{formatDate(l.createdAt)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <Link href={`/benefits/loans/${l.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      คำขอกู้เงินบริษัท {l.year}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.amount)}</TableCell>
                  <TableCell className="text-center tabular-nums">{l.installmentCount}</TableCell>
                  <TableCell className="text-center">
                    <LoanStatusBadge status={l.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
