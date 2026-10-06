"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Check, X, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MobileScreen } from "./mobile-screen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials } from "@/lib/format";
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
    return `ล่วงเวลา · ${fmtDate(r.date)} · ${r.startTime}–${r.endTime} · ${r.hours} ชม.`;
  }
  const r = item.request;
  return `แก้ไขเวลา · ${fmtDate(r.workDate)} · เข้า ${fmtTime(r.requestedClockIn)} ออก ${fmtTime(r.requestedClockOut)}`;
}

function detailHref(item: ReqItem) {
  if (item.kind === "leave") return `/leave/${item.request.id}`;
  if (item.kind === "ot") return `/overtime/${item.request.id}`;
  return `/attendance/corrections/${item.request.id}`;
}

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
      <TabsList>
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
              {(item.request.status === "PENDING" || item.request.status === "APPROVED") && (
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

/** Optional reason for a rejection — the applicant sees it with the decision. */
function RejectDialog({
  target,
  reason,
  onReasonChange,
  loading,
  onCancel,
  onConfirm,
}: {
  target: ReqItem | null;
  reason: string;
  onReasonChange: (v: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !loading && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ปฏิเสธคำขอ{target ? KIND_LABEL[target.kind] : ""}</DialogTitle>
          <DialogDescription>
            {target
              ? `${fullName(target.request.employee.firstName, target.request.employee.lastName)} · ${itemLine(target)}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">เหตุผล (ไม่บังคับ — พนักงานจะเห็นพร้อมผลการพิจารณา)</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="เช่น ช่วงนั้นมีงานด่วน ขอเลื่อนเป็นสัปดาห์หน้า"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onCancel} disabled={loading}>
            ยกเลิก
          </Button>
          <Button variant="destructive" className="h-11" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" />}
            ยืนยันปฏิเสธ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Approvals() {
  const { canAny } = useAuth();
  const canApproveLeave = canAny(["leave:approve", "leave:manage"]);
  const canApproveOt = canAny(["overtime:approve", "overtime:manage"]);
  const canApproveCorrection = canAny(["attendance:approve", "attendance:manage"]);

  // Only ask each source for what this user may approve — an unconditional
  // query for a source they lack came back 403, and that error used to blank
  // out the whole list (including the sources they could see).
  const leaveQ = useLeave("team", "PENDING", { enabled: canApproveLeave });
  const otQ = useOvertime("team", "PENDING", { enabled: canApproveOt });
  const correctionQ = useAttendanceCorrections("team", "PENDING", { enabled: canApproveCorrection });
  const decideLeave = useDecideLeave();
  const decideOt = useDecideOvertime();
  const decideCorrection = useDecideAttendanceCorrection();
  // One card busy at a time, not the whole list: you can read and act on the
  // other requests while one is being saved, and a double-tap on the same
  // card cannot send the decision twice.
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ReqItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

  async function decide(item: ReqItem, action: "approve" | "reject", note?: string): Promise<boolean> {
    const key = `${item.kind}-${item.request.id}`;
    if (busyKey === key) return false;
    setBusyKey(key);
    try {
      const input = { id: item.request.id, action, note: note?.trim() || undefined };
      if (item.kind === "leave") await decideLeave.mutateAsync(input);
      else if (item.kind === "ot") await decideOt.mutateAsync(input);
      else await decideCorrection.mutateAsync(input);
      toast.success(action === "approve" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย");
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ — ตรวจสัญญาณแล้วลองใหม่");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    const ok = await decide(rejectTarget, "reject", rejectReason);
    if (ok) {
      setRejectTarget(null);
      setRejectReason("");
    }
  }

  const enabledQueries = [
    canApproveLeave ? leaveQ : null,
    canApproveOt ? otQ : null,
    canApproveCorrection ? correctionQ : null,
  ].filter((q): q is NonNullable<typeof q> => q !== null);
  const isLoading = enabledQueries.some((q) => q.isLoading);
  const failed = enabledQueries.filter((q) => q.isError);
  const allFailed = enabledQueries.length > 0 && failed.length === enabledQueries.length;
  const retryFailed = () => failed.forEach((q) => q.refetch());

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
          <Button variant="outline" size="sm" className="h-10 shrink-0" onClick={retryFailed}>
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
