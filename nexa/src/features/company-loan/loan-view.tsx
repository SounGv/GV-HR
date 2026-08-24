"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials, formatCurrency, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { LoanStatusBadge } from "./labels";
import { useLoans, useCancelLoan, useDecideLoan, usePayLoan } from "./hooks";
import type { CompanyLoanRequest } from "./types";

function line(r: CompanyLoanRequest) {
  return `${formatDate(r.createdAt)} · ${formatCurrency(r.amount)} · ผ่อน ${r.installmentCount} งวด`;
}

export function LoanView() {
  const { can } = useAuth();
  const canApprove = can("expense:approve");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ของฉัน</TabsTrigger>
        {canApprove && <TabsTrigger value="approvals">รออนุมัติ</TabsTrigger>}
        {canApprove && <TabsTrigger value="pay">รอจ่าย</TabsTrigger>}
      </TabsList>

      <TabsContent value="me">
        <MyLoans />
      </TabsContent>
      {canApprove && (
        <TabsContent value="approvals">
          <Approvals />
        </TabsContent>
      )}
      {canApprove && (
        <TabsContent value="pay">
          <ToPay />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyLoans() {
  const { data, isLoading, isError, refetch } = useLoans("me");
  const cancelMut = useCancelLoan();
  const [cancelTarget, setCancelTarget] = useState<CompanyLoanRequest | null>(null);
  const loans = data?.data ?? [];

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMut.mutateAsync(cancelTarget.id);
      toast.success("ยกเลิกคำขอเรียบร้อย");
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการกู้เงินบริษัท</h2>
        <Button render={<Link href="/benefits/loans/new" />}>
          <Plus className="size-4" /> ยื่นกู้เงินบริษัท
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : loans.length === 0 ? (
        <EmptyState icon={Landmark} title="ยังไม่มีคำขอกู้เงินบริษัท" description="เริ่มต้นด้วยการยื่นกู้ครั้งแรก" />
      ) : (
        <div className="space-y-2">
          {loans.map((r) => (
            <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
              <Link href={`/benefits/loans/${r.id}`} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-foreground">คำขอกู้เงินบริษัท {r.year}</span>
                    <LoanStatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
                </div>
              </Link>
              {r.status === "PENDING" && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(r)}>
                  ยกเลิก
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="ยกเลิกคำขอกู้เงินบริษัท"
        description={cancelTarget ? `ต้องการยกเลิกคำขอกู้เงินปี ${cancelTarget.year} ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ปิด"
        loading={cancelMut.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function Approvals() {
  const { data, isLoading, isError, refetch } = useLoans("team", "PENDING");
  const decideMut = useDecideLoan();
  const loans = data?.data ?? [];

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await decideMut.mutateAsync({ id, action });
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (loans.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอกู้เงินบริษัทของทีมที่รออนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {loans.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <Link href={`/benefits/loans/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-9">
              {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(r.employee.firstName, r.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{fullName(r.employee.firstName, r.employee.lastName)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "reject")}>
              <X className="size-4" /> ปฏิเสธ
            </Button>
            <Button size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "approve")}>
              <Check className="size-4" /> อนุมัติ
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ToPay() {
  const { data, isLoading, isError, refetch } = useLoans("all", "APPROVED");
  const payMut = usePayLoan();
  const loans = data?.data ?? [];

  async function pay(id: string) {
    try {
      await payMut.mutateAsync(id);
      toast.success("บันทึกการจ่ายเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (loans.length === 0) {
    return <EmptyState icon={Wallet} title="ไม่มีรายการรอจ่าย" description="คำขอที่อนุมัติแล้วและรอจ่ายเงินจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {loans.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <Link href={`/benefits/loans/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-9">
              {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(r.employee.firstName, r.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{fullName(r.employee.firstName, r.employee.lastName)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
            </div>
          </Link>
          <Button size="sm" disabled={payMut.isPending} onClick={() => pay(r.id)}>
            <Wallet className="size-4" /> จ่ายแล้ว
          </Button>
        </Card>
      ))}
    </div>
  );
}
