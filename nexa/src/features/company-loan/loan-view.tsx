"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, Landmark, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { getInitials, formatCurrency, formatDate, displayName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { LoanStatusBadge } from "./labels";
import { useLoans, useCancelLoan, useDecideLoan, usePayLoan } from "./hooks";
import type { CompanyLoanRequest } from "./types";

function Requester({ r }: { r: CompanyLoanRequest }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
        <AvatarFallback className="bg-primary/10 text-xs text-primary">
          {getInitials(r.employee.firstName, r.employee.lastName)}
        </AvatarFallback>
      </Avatar>
      <span>{displayName(r.employee)}</span>
    </div>
  );
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
  const hasEmployee = !!useAuth().user.employee;
  const { data, isLoading, isError, error, refetch } = useLoans("me");
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
        {hasEmployee && (
          <Button size="sm" render={<Link href="/benefits/loans/new" />}>
            <Plus className="size-4" /> ยื่นกู้เงินบริษัท
          </Button>
        )}
      </div>

      {!hasEmployee ? (
        <NoEmployeeState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : loans.length === 0 ? (
        <EmptyState icon={Landmark} title="ยังไม่มีคำขอกู้เงินบริษัท" description="เริ่มต้นด้วยการยื่นกู้ครั้งแรก" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่ยื่น</TableHead>
              <TableHead className="w-full">คำขอ</TableHead>
              <TableHead className="text-right">วงเงินกู้</TableHead>
              <TableHead className="text-center">งวด</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{formatDate(r.createdAt)}</TableCell>
                <TableCell className="whitespace-normal">
                  <Link href={`/benefits/loans/${r.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    คำขอกู้เงินบริษัท {r.year}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
                <TableCell className="text-center tabular-nums">{r.installmentCount}</TableCell>
                <TableCell className="text-center">
                  <LoanStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-center">
                  {r.status === "PENDING" && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(r)}>
                      ยกเลิก
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      toast.success(action === "approve" ? "อนุมัติแล้ว" : "ไม่อนุมัติคำขอแล้ว");
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>วันที่ยื่น</TableHead>
          <TableHead className="w-full">ผู้ขอ</TableHead>
          <TableHead className="text-right">วงเงินกู้</TableHead>
          <TableHead className="text-center">งวด</TableHead>
          <TableHead className="text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular-nums">{formatDate(r.createdAt)}</TableCell>
            <TableCell className="whitespace-normal">
              <Link href={`/benefits/loans/${r.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                <Requester r={r} />
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
            <TableCell className="text-center tabular-nums">{r.installmentCount}</TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "reject")}>
                  <X className="size-4" /> ไม่อนุมัติ
                </Button>
                <Button size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "approve")}>
                  <Check className="size-4" /> อนุมัติ
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>วันที่ยื่น</TableHead>
          <TableHead className="w-full">ผู้ขอ</TableHead>
          <TableHead className="text-right">วงเงินกู้</TableHead>
          <TableHead className="text-center">งวด</TableHead>
          <TableHead className="text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular-nums">{formatDate(r.createdAt)}</TableCell>
            <TableCell className="whitespace-normal">
              <Link href={`/benefits/loans/${r.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                <Requester r={r} />
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
            <TableCell className="text-center tabular-nums">{r.installmentCount}</TableCell>
            <TableCell className="text-center">
              <Button size="sm" disabled={payMut.isPending} onClick={() => pay(r.id)}>
                <Wallet className="size-4" /> จ่ายแล้ว
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
