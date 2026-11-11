"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Check, X, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MobileScreen } from "./mobile-screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CharacterAvatar, characterFor } from "@/components/shared/character-avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { displayName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { LeaveStatusBadge } from "@/features/leave/labels";
import { useLeave, useCancelLeave } from "@/features/leave/hooks";
import { useOvertime, useCancelOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections, useCancelAttendanceCorrection } from "@/features/attendance-correction/hooks";
import {
  KIND_LABEL,
  RejectDialog,
  detailHref,
  itemLine,
  useApprovalQueue,
  type ReqItem,
} from "@/features/requests/approval-queue";

export function MobileRequestsView({ defaultTab = "me" }: { defaultTab?: "me" | "approvals" }) {
  return (
    <MobileScreen title="คำขอ" contentClassName="p-4">
      <RequestsBody defaultTab={defaultTab} />
    </MobileScreen>
  );
}

function RequestsBody({ defaultTab }: { defaultTab: "me" | "approvals" }) {
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
    <Tabs defaultValue={canApprove ? defaultTab : "me"} className="space-y-4">
      <TabsList className="group-data-horizontal/tabs:h-[54px]">
        <TabsTrigger value="me">ของฉัน</TabsTrigger>
        {canApprove && (
          <TabsTrigger value="approvals" className="gap-1.5">
            รออนุมัติ
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-white">
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
        <Button className="h-11 flex-1" render={<Link href="/leave/new" />}>
          <Plus className="size-4" /> ขอลา
        </Button>
        <Button className="h-11 flex-1" variant="outline" render={<Link href="/overtime/new" />}>
          <Plus className="size-4" /> ขอ OT
        </Button>
        <Button className="h-11 flex-1" variant="outline" render={<Link href="/attendance/corrections/new" />}>
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
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-foreground">{KIND_LABEL[item.kind]}</span>
                    <LeaveStatusBadge status={item.request.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{itemLine(item)}</p>
                </div>
              </Link>
              {/* A time correction can only be withdrawn while it is still waiting; leave and OT also after approval. */}
              {(item.request.status === "PENDING" || (item.request.status === "APPROVED" && item.kind !== "correction")) && (
                <Button variant="ghost" size="sm" className="h-11 min-w-16 text-destructive" onClick={() => setTarget(item)}>
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
  const {
    items,
    decide,
    busyKey,
    rejectTarget,
    setRejectTarget,
    rejectReason,
    setRejectReason,
    confirmReject,
    isLoading,
    failed,
    allFailed,
    retryFailed,
  } = useApprovalQueue();

  if (allFailed) return <ErrorState onRetry={retryFailed} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (items.length === 0 && failed.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอลา, OT และแก้ไขเวลาของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {failed.length > 0 && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <span className="min-w-0">โหลดคำขอบางประเภทไม่สำเร็จ — รายการด้านล่างอาจไม่ครบ</span>
          <Button variant="outline" size="sm" className="h-11 shrink-0" onClick={retryFailed}>
            ลองใหม่
          </Button>
        </div>
      )}
      <RejectDialog
        target={rejectTarget}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        loading={rejectTarget ? busyKey === `${rejectTarget.kind}-${rejectTarget.request.id}` : false}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={confirmReject}
      />
      {items.map((item) => {
        const key = `${item.kind}-${item.request.id}`;
        const busy = busyKey === key;
        return (
        <Card key={key} className="flex-col gap-3 p-4">
          <Link href={detailHref(item)} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-9">
              {item.request.employee.avatarUrl && (
                <AvatarImage src={item.request.employee.avatarUrl} alt={item.request.employee.firstName} />
              )}
              <AvatarFallback className="bg-transparent p-0">
                <CharacterAvatar
                  character={characterFor({ gender: item.request.employee.gender ?? null })}
                  seed={item.request.employee.id}
                  className="size-full"
                />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {displayName(item.request.employee)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{itemLine(item)}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={busy}
              onClick={() => {
                setRejectReason("");
                setRejectTarget(item);
              }}
            >
              <X className="size-4" /> ปฏิเสธ
            </Button>
            <Button className="h-11 flex-1" disabled={busy} onClick={() => decide(item, "approve")}>
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" /> : <Check className="size-4" />} อนุมัติ
            </Button>
          </div>
        </Card>
        );
      })}
    </div>
  );
}
