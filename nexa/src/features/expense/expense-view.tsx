"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, Receipt, Wallet } from "lucide-react";
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

import { ExpenseStatusBadge, EXPENSE_CATEGORY_LABEL } from "./labels";
import {
  useExpenses,
  useCancelExpense,
  useDecideExpense,
  usePayExpense,
} from "./hooks";
import type { ExpenseClaim } from "./types";

function line(r: ExpenseClaim) {
  return `${formatDate(r.expenseDate)} · ${EXPENSE_CATEGORY_LABEL[r.category]} · ${formatCurrency(r.amount)}`;
}

export function ExpenseView() {
  const { can } = useAuth();
  const canApprove = can("expense:approve");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">คำขอของฉัน</TabsTrigger>
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
  );
}

function MyClaims() {
  const { data, isLoading, isError, refetch } = useExpenses("me");
  const cancelMut = useCancelExpense();
  const [cancelTarget, setCancelTarget] = useState<ExpenseClaim | null>(null);
  const claims = data?.data ?? [];

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
        <h2 className="text-sm font-semibold text-foreground">ประวัติการเบิกจ่าย</h2>
        <Button render={<Link href="/expenses/new" />}>
          <Plus className="size-4" /> ขอเบิกจ่าย
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : claims.length === 0 ? (
        <EmptyState icon={Receipt} title="ยังไม่มีรายการเบิกจ่าย" description="เริ่มต้นด้วยการยื่นขอเบิกค่าใช้จ่าย" />
      ) : (
        <div className="space-y-2">
          {claims.map((r) => (
            <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{r.title}</span>
                  <ExpenseStatusBadge status={r.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
              </div>
              {r.status === "PENDING" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setCancelTarget(r)}
                >
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
        title="ยกเลิกรายการเบิกจ่าย"
        description={cancelTarget ? `ต้องการยกเลิก “${cancelTarget.title}” ใช่หรือไม่?` : undefined}
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
  const claims = data?.data ?? [];

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
  if (claims.length === 0) {
    return (
      <EmptyState
        icon={Check}
        title="ไม่มีรายการรออนุมัติ"
        description="รายการเบิกจ่ายของทีมที่รอการอนุมัติจะแสดงที่นี่"
      />
    );
  }

  return (
    <div className="space-y-2">
      {claims.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(r.employee.firstName, r.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {r.title} — {fullName(r.employee.firstName, r.employee.lastName)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {line(r)}
                {r.description ? ` · ${r.description}` : ""}
              </p>
            </div>
          </div>
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
  const { data, isLoading, isError, refetch } = useExpenses("all", "APPROVED");
  const payMut = usePayExpense();
  const claims = data?.data ?? [];

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
    return (
      <EmptyState
        icon={Wallet}
        title="ไม่มีรายการรอจ่าย"
        description="รายการที่อนุมัติแล้วและรอการจ่ายเงินจะแสดงที่นี่"
      />
    );
  }

  return (
    <div className="space-y-2">
      {claims.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(r.employee.firstName, r.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {r.title} — {fullName(r.employee.firstName, r.employee.lastName)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
            </div>
          </div>
          <Button size="sm" disabled={payMut.isPending} onClick={() => pay(r.id)}>
            <Wallet className="size-4" /> จ่ายแล้ว
          </Button>
        </Card>
      ))}
    </div>
  );
}
