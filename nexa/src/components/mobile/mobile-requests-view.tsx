"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Check, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { MobileScreen } from "./mobile-screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials, formatCurrency } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { LEAVE_TYPE_LABEL, LeaveStatusBadge } from "@/features/leave/labels";
import { useLeave, useCancelLeave, useDecideLeave } from "@/features/leave/hooks";
import { useOvertime, useCancelOvertime, useDecideOvertime } from "@/features/overtime/hooks";
import type { LeaveRequest } from "@/features/leave/types";
import type { OvertimeRequest } from "@/features/overtime/types";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

type LeaveItem = { kind: "leave"; request: LeaveRequest };
type OtItem = { kind: "ot"; request: OvertimeRequest };
type ReqItem = LeaveItem | OtItem;

function itemLine(item: ReqItem) {
  if (item.kind === "leave") {
    const r = item.request;
    const range = r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
    return `${LEAVE_TYPE_LABEL[r.type]} · ${range} · ${r.days} วัน`;
  }
  const r = item.request;
  return `ล่วงเวลา · ${fmtDate(r.date)} · ${r.startTime}–${r.endTime} · ${r.hours} ชม. · ≈ ${formatCurrency(r.estimatedAmount)}`;
}

export function MobileRequestsView() {
  return (
    <MobileScreen title="คำขอ" contentClassName="p-4">
      <RequestsBody />
    </MobileScreen>
  );
}

function RequestsBody() {
  const { can } = useAuth();
  const canApproveLeave = can("leave:approve");
  const canApproveOt = can("overtime:approve");
  const canApprove = canApproveLeave || canApproveOt;
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const pendingCount = (leavePendingQ.data?.data.length ?? 0) + (otPendingQ.data?.data.length ?? 0);

  return (
    <Tabs defaultValue="me" className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">ของฉัน</TabsTrigger>
        {canApprove && (
          <TabsTrigger value="approvals" className="gap-1.5">
            รออนุมัติ
            {pendingCount > 0 && (
              <span className="flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="me" className="space-y-4">
        <MyRequests />
      </TabsContent>

      {canApprove && (
        <TabsContent value="approvals" className="space-y-4">
          <Approvals />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyRequests() {
  const leaveQ = useLeave("me");
  const otQ = useOvertime("me");
  const cancelLeave = useCancelLeave();
  const cancelOt = useCancelOvertime();
  const [target, setTarget] = useState<ReqItem | null>(null);

  const items = useMemo<ReqItem[]>(() => {
    const leave: ReqItem[] = (leaveQ.data?.data ?? []).map((r) => ({ kind: "leave", request: r }));
    const ot: ReqItem[] = (otQ.data?.data ?? []).map((r) => ({ kind: "ot", request: r }));
    return [...leave, ...ot].sort(
      (a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime(),
    );
  }, [leaveQ.data, otQ.data]);

  async function confirmCancel() {
    if (!target) return;
    try {
      if (target.kind === "leave") await cancelLeave.mutateAsync(target.request.id);
      else await cancelOt.mutateAsync(target.request.id);
      toast.success("ยกเลิกคำขอเรียบร้อย");
      setTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  const isLoading = leaveQ.isLoading || otQ.isLoading;
  const isError = leaveQ.isError || otQ.isError;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button className="flex-1" render={<Link href="/leave/new" />}>
          <Plus className="size-4" /> ขอลา
        </Button>
        <Button className="flex-1" variant="outline" render={<Link href="/overtime/new" />}>
          <Plus className="size-4" /> ขอ OT
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => { leaveQ.refetch(); otQ.refetch(); }} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="ยังไม่มีคำขอ" description="เริ่มต้นด้วยการยื่นคำขอลาหรือ OT" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={`${item.kind}-${item.request.id}`} className="flex-row items-center justify-between gap-3 p-4">
              <Link href={item.kind === "leave" ? `/leave/${item.request.id}` : `/overtime/${item.request.id}`} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.kind === "leave" ? "การลา" : "ล่วงเวลา (OT)"}</span>
                    <LeaveStatusBadge status={item.request.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{itemLine(item)}</p>
                </div>
              </Link>
              {(item.request.status === "PENDING" || item.request.status === "APPROVED") && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setTarget(item)}>
                  ยกเลิก
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target?.kind === "ot" ? "ยกเลิกคำขอ OT" : "ยกเลิกคำขอลา"}
        description={target ? `ต้องการยกเลิก${itemLine(target)} ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ปิด"
        loading={cancelLeave.isPending || cancelOt.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function Approvals() {
  const { can } = useAuth();
  const canApproveLeave = can("leave:approve");
  const canApproveOt = can("overtime:approve");

  const leaveQ = useLeave("team", "PENDING");
  const otQ = useOvertime("team", "PENDING");
  const decideLeave = useDecideLeave();
  const decideOt = useDecideOvertime();

  const items = useMemo<ReqItem[]>(() => {
    const leave: ReqItem[] = canApproveLeave ? (leaveQ.data?.data ?? []).map((r) => ({ kind: "leave", request: r })) : [];
    const ot: ReqItem[] = canApproveOt ? (otQ.data?.data ?? []).map((r) => ({ kind: "ot", request: r })) : [];
    return [...leave, ...ot].sort(
      (a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime(),
    );
  }, [leaveQ.data, otQ.data, canApproveLeave, canApproveOt]);

  async function decide(item: ReqItem, action: "approve" | "reject") {
    try {
      if (item.kind === "leave") await decideLeave.mutateAsync({ id: item.request.id, action });
      else await decideOt.mutateAsync({ id: item.request.id, action });
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  const isLoading = (canApproveLeave && leaveQ.isLoading) || (canApproveOt && otQ.isLoading);
  const isError = leaveQ.isError || otQ.isError;
  const deciding = decideLeave.isPending || decideOt.isPending;

  if (isError) return <ErrorState onRetry={() => { leaveQ.refetch(); otQ.refetch(); }} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (items.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอลาและ OT ของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={`${item.kind}-${item.request.id}`} className="flex-col gap-3 p-4">
          <Link
            href={item.kind === "leave" ? `/leave/${item.request.id}` : `/overtime/${item.request.id}`}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <Avatar className="size-9">
              {item.request.employee.avatarUrl && (
                <AvatarImage src={item.request.employee.avatarUrl} alt={item.request.employee.firstName} />
              )}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {getInitials(item.request.employee.firstName, item.request.employee.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {fullName(item.request.employee.firstName, item.request.employee.lastName)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{itemLine(item)}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" disabled={deciding} onClick={() => decide(item, "reject")}>
              <X className="size-4" /> ปฏิเสธ
            </Button>
            <Button size="sm" className="flex-1" disabled={deciding} onClick={() => decide(item, "approve")}>
              <Check className="size-4" /> อนุมัติ
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
