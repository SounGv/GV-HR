"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, Stethoscope, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { getInitials, formatCurrency, formatDate, displayName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { ExpenseStatusBadge } from "./labels";
import { useExpenses, useCancelExpense, useDecideExpense, usePayExpense, useSubmitExpense, useMedicalSummary } from "./hooks";
import type { ExpenseClaim } from "./types";

function Requester({ r }: { r: ExpenseClaim }) {
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

function TitleLink({ r }: { r: ExpenseClaim }) {
  return (
    <Link href={`/expenses/${r.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
      {r.title}
    </Link>
  );
}

export function MedicalClaimsView() {
  const { can } = useAuth();
  const canApprove = can("expense:approve");
  const { data: summaryData } = useMedicalSummary();
  const summary = summaryData?.data;

  return (
    <div className="space-y-4">
      {summary && (
        <Card className="gap-2 border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Stethoscope className="size-5 text-primary" /> วงเงินค่ารักษาพยาบาลปีนี้
          </p>
          <p className="text-sm text-muted-foreground">
            คงเหลือยื่นได้ <span className="text-lg font-semibold text-primary">{summary.remaining.toLocaleString()}</span> จาก{" "}
            {summary.cap.toLocaleString()} บาท (อนุมัติแล้ว {summary.approved.toLocaleString()} · รออนุมัติ {summary.pending.toLocaleString()})
          </p>
        </Card>
      )}

      <Tabs defaultValue="me" className="space-y-4">
        <TabsList>
          <TabsTrigger value="me">ของฉัน</TabsTrigger>
          {canApprove && <TabsTrigger value="approvals">รออนุมัติ</TabsTrigger>}
          {canApprove && <TabsTrigger value="pay">รอจ่าย</TabsTrigger>}
        </TabsList>

        <TabsContent value="me">
          <MyClaims />
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
    </div>
  );
}

function MyClaims() {
  const hasEmployee = !!useAuth().user.employee;
  const { data, isLoading, isError, error, refetch } = useExpenses("me");
  const cancelMut = useCancelExpense();
  const submitMut = useSubmitExpense();
  const [cancelTarget, setCancelTarget] = useState<ExpenseClaim | null>(null);
  const claims = (data?.data ?? []).filter((c) => c.category === "medical");

  async function confirmCancel() {
    if (!cancelTarget) return;
    try {
      await cancelMut.mutateAsync(cancelTarget.id);
      toast.success("ยกเลิกรายการเรียบร้อย");
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  async function submitDraft(id: string) {
    try {
      await submitMut.mutateAsync(id);
      toast.success("ส่งคำขอเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการเบิกค่ารักษาพยาบาล</h2>
        {hasEmployee && (
          <Button size="sm" render={<Link href="/benefits/medical/new" />}>
            <Plus className="size-4" /> ยื่นเบิกค่ารักษา
          </Button>
        )}
      </div>

      {!hasEmployee ? (
        <NoEmployeeState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : claims.length === 0 ? (
        <EmptyState icon={Stethoscope} title="ยังไม่มีรายการเบิกค่ารักษาพยาบาล" description="เริ่มต้นด้วยการยื่นเบิกครั้งแรก" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>วันที่</TableHead>
              <TableHead className="w-full">เรื่อง</TableHead>
              <TableHead>โรงพยาบาล</TableHead>
              <TableHead className="text-right">จำนวนเงิน</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{formatDate(r.expenseDate)}</TableCell>
                <TableCell className="whitespace-normal">
                  <TitleLink r={r} />
                </TableCell>
                <TableCell>{r.hospitalName ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
                <TableCell className="text-center">
                  <ExpenseStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {r.status === "DRAFT" && (
                      <Button size="sm" disabled={submitMut.isPending} onClick={() => submitDraft(r.id)}>
                        ส่งคำขอ
                      </Button>
                    )}
                    {(r.status === "PENDING" || r.status === "DRAFT") && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(r)}>
                        ยกเลิก
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="ยกเลิกรายการเบิกค่ารักษาพยาบาล"
        description={cancelTarget ? `ต้องการยกเลิก "${cancelTarget.title}" ใช่หรือไม่?` : undefined}
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
  const { data, isLoading, isError, refetch } = useExpenses("team", "PENDING");
  const decideMut = useDecideExpense();
  const claims = (data?.data ?? []).filter((c) => c.category === "medical");

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
  if (claims.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีรายการรออนุมัติ" description="คำขอเบิกค่ารักษาพยาบาลของทีมที่รออนุมัติจะแสดงที่นี่" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>วันที่</TableHead>
          <TableHead>ผู้ขอ</TableHead>
          <TableHead className="w-full">เรื่อง</TableHead>
          <TableHead>โรงพยาบาล</TableHead>
          <TableHead className="text-right">จำนวนเงิน</TableHead>
          <TableHead className="text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular-nums">{formatDate(r.expenseDate)}</TableCell>
            <TableCell>
              <Requester r={r} />
            </TableCell>
            <TableCell className="whitespace-normal">
              <TitleLink r={r} />
              {r.description && <p className="text-xs break-words text-muted-foreground">{r.description}</p>}
            </TableCell>
            <TableCell>{r.hospitalName ?? "-"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
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
  const { data, isLoading, isError, refetch } = useExpenses("all", "APPROVED");
  const payMut = usePayExpense();
  const claims = (data?.data ?? []).filter((c) => c.category === "medical");

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
  if (claims.length === 0) {
    return <EmptyState icon={Wallet} title="ไม่มีรายการรอจ่าย" description="รายการที่อนุมัติแล้วและรอจ่ายเงินจะแสดงที่นี่" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>วันที่</TableHead>
          <TableHead>ผู้ขอ</TableHead>
          <TableHead className="w-full">เรื่อง</TableHead>
          <TableHead>โรงพยาบาล</TableHead>
          <TableHead className="text-right">จำนวนเงิน</TableHead>
          <TableHead className="text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {claims.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="tabular-nums">{formatDate(r.expenseDate)}</TableCell>
            <TableCell>
              <Requester r={r} />
            </TableCell>
            <TableCell className="whitespace-normal">
              <TitleLink r={r} />
            </TableCell>
            <TableCell>{r.hospitalName ?? "-"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
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
