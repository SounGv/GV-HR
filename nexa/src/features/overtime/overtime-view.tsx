"use client";

import { useState } from "react";
import { Plus, Check, X, Timer } from "lucide-react";
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
import { LeaveStatusBadge } from "@/features/leave/labels";

import { OvertimeDialog } from "./overtime-dialog";
import { useOvertime, useCancelOvertime, useDecideOvertime } from "./hooks";
import type { OvertimeRequest } from "./types";

function line(r: OvertimeRequest) {
  return `${formatDate(r.date)} · ${r.startTime}–${r.endTime} · ${r.hours} ชม. · ≈ ${formatCurrency(r.estimatedAmount)}`;
}

export function OvertimeView() {
  const { can } = useAuth();
  const canApprove = can("overtime:approve");

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">คำขอของฉัน</TabsTrigger>
        {canApprove && <TabsTrigger value="approvals">รออนุมัติ</TabsTrigger>}
      </TabsList>

      <TabsContent value="me">
        <MyRequests />
      </TabsContent>

      {canApprove && (
        <TabsContent value="approvals">
          <Approvals />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyRequests() {
  const { data, isLoading, isError, refetch } = useOvertime("me");
  const cancelMut = useCancelOvertime();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OvertimeRequest | null>(null);
  const requests = data?.data ?? [];

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
        <h2 className="text-sm font-semibold text-foreground">ประวัติคำขอ OT</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> ขอ OT
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : requests.length === 0 ? (
        <EmptyState icon={Timer} title="ยังไม่มีคำขอ OT" description="เริ่มต้นด้วยการยื่นคำขอทำงานล่วงเวลา" />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">ล่วงเวลา</span>
                  <LeaveStatusBadge status={r.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
              </div>
              {(r.status === "PENDING" || r.status === "APPROVED") && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(r)}>
                  ยกเลิก
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <OvertimeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="ยกเลิกคำขอ OT"
        description={cancelTarget ? `ต้องการยกเลิกคำขอ ${line(cancelTarget)} ใช่หรือไม่?` : undefined}
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
  const { data, isLoading, isError, refetch } = useOvertime("team", "PENDING");
  const decideMut = useDecideOvertime();
  const requests = data?.data ?? [];

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
  if (requests.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอ OT ของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
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
                {fullName(r.employee.firstName, r.employee.lastName)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {line(r)}
                {r.reason ? ` · ${r.reason}` : ""}
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
