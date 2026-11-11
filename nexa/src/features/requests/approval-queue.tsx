"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { useAuth } from "@/features/auth/auth-context";
import { displayName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { LEAVE_TYPE_LABEL, HALF_DAY_PERIOD_LABEL } from "@/features/leave/labels";
import { useLeave, useDecideLeave } from "@/features/leave/hooks";
import { useOvertime, useDecideOvertime } from "@/features/overtime/hooks";
import { useAttendanceCorrections, useDecideAttendanceCorrection } from "@/features/attendance-correction/hooks";
import type { LeaveRequest } from "@/features/leave/types";
import type { OvertimeRequest } from "@/features/overtime/types";
import type { AttendanceCorrectionRequest } from "@/features/attendance-correction/types";

/**
 * The approval queue shared by the phone (MobileRequestsView) and desktop
 * (ApprovalsDesk) screens: one list of pending leave / OT / time-correction
 * requests the signed-in user may decide, and one way to approve or reject.
 */

export function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

export function fmtTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

type LeaveItem = { kind: "leave"; request: LeaveRequest };
type OtItem = { kind: "ot"; request: OvertimeRequest };
type CorrectionItem = { kind: "correction"; request: AttendanceCorrectionRequest };
export type ReqItem = LeaveItem | OtItem | CorrectionItem;

export const KIND_LABEL: Record<ReqItem["kind"], string> = {
  leave: "การลา",
  ot: "ล่วงเวลา (OT)",
  correction: "แก้ไขเวลา",
};

export function itemLine(item: ReqItem) {
  if (item.kind === "leave") {
    const r = item.request;
    const isHourly = r.unit === "HOUR";
    const range = isHourly
      ? `${fmtDate(r.startDate)} (${r.startTime}–${r.endTime})`
      : r.startDate === r.endDate
        ? fmtDate(r.startDate)
        : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
    // A half-day request's "0.5 วัน" alone doesn't say which half — the
    // approver needs to know morning vs. afternoon, not just the count
    // (older requests from before halfDayPeriod existed fall back to a
    // plain "ครึ่งวัน").
    const amount = isHourly
      ? `${r.hours} ชม.`
      : r.halfDay
        ? `ครึ่งวัน${r.halfDayPeriod ? ` (${HALF_DAY_PERIOD_LABEL[r.halfDayPeriod]})` : ""}`
        : `${r.days} วัน`;
    return `${LEAVE_TYPE_LABEL[r.type]} · ${range} · ${amount}`;
  }
  if (item.kind === "ot") {
    const r = item.request;
    return `ล่วงเวลา · ${fmtDate(r.date)} · ${r.startTime}–${r.endTime} · ${r.hours} ชม.`;
  }
  const r = item.request;
  return `แก้ไขเวลา · ${fmtDate(r.workDate)} · เข้า ${fmtTime(r.requestedClockIn)} ออก ${fmtTime(r.requestedClockOut)}`;
}

export function detailHref(item: ReqItem) {
  if (item.kind === "leave") return `/leave/${item.request.id}`;
  if (item.kind === "ot") return `/overtime/${item.request.id}`;
  return `/attendance/corrections/${item.request.id}`;
}

/**
 * Pending requests this user can decide, plus approve/reject with one row busy
 * at a time. Each source is only queried when the user may approve it.
 */
export function useApprovalQueue() {
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

  return {
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
  };
}

/** Optional reason for a rejection — the applicant sees it with the decision. */
export function RejectDialog({
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
              ? `${displayName(target.request.employee)} · ${itemLine(target)}`
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
