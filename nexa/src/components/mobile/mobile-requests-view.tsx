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
import {
  useAttendanceCorrections,
  useCancelAttendanceCorrection,
  useDecideAttendanceCorrection,
} from "@/features/attendance-correction/hooks";
import type { LeaveRequest } from "@/features/leave/types";
import type { OvertimeRequest } from "@/features/overtime/types";
import type { AttendanceCorrectionRequest } from "@/features/attendance-correction/types";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

type LeaveItem = { kind: "leave"; request: LeaveRequest };
type OtItem = { kind: "ot"; request: OvertimeRequest };
type CorrectionItem = { kind: "correction"; request: AttendanceCorrectionRequest };
type ReqItem = LeaveItem | OtItem | CorrectionItem;

const KIND_LABEL: Record<ReqItem["kind"], string> = {
  leave: "การลา",
  ot: "ล่วงเวลา (OT)",
  correction: "แก้ไขเวลา",
};

function itemLine(item: ReqItem) {
  if (item.kind === "leave") {
    const r = item.request;
    const isHourly = r.unit === "HOUR";
    const range = isHourly
      ? `${fmtDate(r.startDate)} (${r.startTime}–${r.endTime})`
      : r.startDate === r.endDate
        ? fmtDate(r.startDate)
        : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
    const amount = isHourly ? `${r.hours} ชม.` : `${r.days} วัน`;
    return `${LEAVE_TYPE_LABEL[r.type]} · ${range} · ${amount}`;
  }
  if (item.kind === "ot") {
    const r = item.request;
    return `ล่วงเวลา · ${fmtDate(r.date)} · ${r.startTime}–${r.endTime} · ${r.hours} ชม. · ≈ ${formatCurrency(r.estimatedAmount)}`;
  }
  const r = item.request;
  return `แก้ไขเวลา · ${fmtDate(r.workDate)} · เข้า ${fmtTime(r.requestedClockIn)} ออก ${fmtTime(r.requestedClockOut)}`;
}

function detailHref(item: ReqItem) {
  if (item.kind === "leave") return `/leave/${item.request.id}`;
  if (item.kind === "ot") return `/overtime/${item.request.id}`;
  return `/attendance/corrections/${item.request.id}`;
}

export function MobileRequestsView() {
  return (
    <MobileScreen title="คำขอ" contentClassName="p-4">
      <RequestsBody />
    </MobileScreen>
  );
}

function RequestsBody() {
  const { canAny } = useAuth();
  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);
  const canApprove = canApproveLeave || canApproveOt || canApproveCorrection;
  const leavePendingQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otPendingQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const correctionPendingQ = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
  const pendingCount =
    (leavePendingQ.data?.data.length ?? 0) + (otPendingQ.data?.data.length ?? 0) + (correctionPendingQ.data?.data.length ?? 0);

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
  const correctionQ = useAttendanceCorrections("me");
  const cancelLeave = useCancelLeave();
  const cancelOt = useCancelOvertime();
  const cancelCorrection = useCancelAttendanceCorrection();
  const [target, setTarget] = useState<ReqItem | null>(null);

  const items = useMemo<ReqItem[]>(() => {
    const leave: ReqItem[] = (leaveQ.data?.data ?? []).map((r) => ({ kind: "leave", request: r }));
    const ot: ReqItem[] = (otQ.data?.data ?? []).map((r) => ({ kind: "ot", request: r }));
    const correction: ReqItem[] = (correctionQ.data?.data ?? []).map((r) => ({ kind: "correction", request: r }));
    return [...leave, ...ot, ...correction].sort(
      (a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime(),
    );
  }, [leaveQ.data, otQ.data, correctionQ.data]);

  async function confirmCancel() {
    if (!target) return;
    try {
      if (target.kind === "leave") await cancelLeave.mutateAsync(target.request.id);
      else if (target.kind === "ot") await cancelOt.mutateAsync(target.request.id);
      else await cancelCorrection.mutateAsync(target.request.id);
      toast.success("ยกเลิกคำขอเรียบร้อย");
      setTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  const isLoading = leaveQ.isLoading || otQ.isLoading || correctionQ.isLoading;
  const isError = leaveQ.isError || otQ.isError || correctionQ.isError;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button className="flex-1" render={<Link href="/leave/new" />}>
          <Plus className="size-4" /> ขอลา
        </Button>
        <Button className="flex-1" variant="outline" render={<Link href="/overtime/new" />}>
          <Plus className="size-4" /> ขอ OT
        </Button>
        <Button className="flex-1" variant="outline" render={<Link href="/attendance/corrections/new" />}>
          <Plus className="size-4" /> แก้เวลา
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => { leaveQ.refetch(); otQ.refetch(); correctionQ.refetch(); }} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="ยังไม่มีคำขอ" description="เริ่มต้นด้วยการยื่นคำขอลา, OT หรือแก้ไขเวลา" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={`${item.kind}-${item.request.id}`} className="flex-row items-center justify-between gap-3 p-4">
              <Link href={detailHref(item)} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{KIND_LABEL[item.kind]}</span>
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
        title={`ยกเลิกคำขอ${target ? KIND_LABEL[target.kind] : ""}`}
        description={target ? `ต้องการยกเลิก${itemLine(target)} ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ปิด"
        loading={cancelLeave.isPending || cancelOt.isPending || cancelCorrection.isPending}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

function Approvals() {
  const { canAny } = useAuth();
  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);

  const leaveQ = useLeave("team", "PENDING");
  const otQ = useOvertime("team", "PENDING");
  const correctionQ = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
  const decideLeave = useDecideLeave();
  const decideOt = useDecideOvertime();
  const decideCorrection = useDecideAttendanceCorrection();

  const items = useMemo<ReqItem[]>(() => {
    const leave: ReqItem[] = canApproveLeave ? (leaveQ.data?.data ?? []).map((r) => ({ kind: "leave", request: r })) : [];
    const ot: ReqItem[] = canApproveOt ? (otQ.data?.data ?? []).map((r) => ({ kind: "ot", request: r })) : [];
    const correction: ReqItem[] = canApproveCorrection
      ? (correctionQ.data?.data ?? []).map((r) => ({ kind: "correction", request: r }))
      : [];
    return [...leave, ...ot, ...correction].sort(
      (a, b) => new Date(b.request.createdAt).getTime() - new Date(a.request.createdAt).getTime(),
    );
  }, [leaveQ.data, otQ.data, correctionQ.data, canApproveLeave, canApproveOt, canApproveCorrection]);

  async function decide(item: ReqItem, action: "approve" | "reject") {
    try {
      if (item.kind === "leave") await decideLeave.mutateAsync({ id: item.request.id, action });
      else if (item.kind === "ot") await decideOt.mutateAsync({ id: item.request.id, action });
      else await decideCorrection.mutateAsync({ id: item.request.id, action });
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  const isLoading = (canApproveLeave && leaveQ.isLoading) || (canApproveOt && otQ.isLoading) || (canApproveCorrection && correctionQ.isLoading);
  const isError = leaveQ.isError || otQ.isError || correctionQ.isError;
  const deciding = decideLeave.isPending || decideOt.isPending || decideCorrection.isPending;

  if (isError) return <ErrorState onRetry={() => { leaveQ.refetch(); otQ.refetch(); correctionQ.refetch(); }} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (items.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอลา, OT และแก้ไขเวลาของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={`${item.kind}-${item.request.id}`} className="flex-col gap-3 p-4">
          <Link href={detailHref(item)} className="flex min-w-0 flex-1 items-center gap-3">
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
