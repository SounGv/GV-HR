"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, CalendarDays, UserRoundX } from "lucide-react";
import { toast } from "sonner";

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

import { BalanceCards } from "./balance-cards";
import { useLeave, useCancelLeave, useDecideLeave } from "./hooks";
import { LEAVE_TYPE_LABEL, LeaveStatusBadge, HALF_DAY_PERIOD_LABEL } from "./labels";
import type { LeaveRequest } from "./types";

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function dateRange(r: LeaveRequest) {
  if (r.unit === "HOUR" && r.startTime && r.endTime) {
    return `${fmtDate(r.startDate)} (${r.startTime}–${r.endTime})`;
  }
  return r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;
}

function amountLabel(r: LeaveRequest) {
  if (r.unit === "HOUR") return `${r.hours} ชม.`;
  // A half-day request's "0.5 วัน" alone doesn't say which half — the
  // approver needs morning vs. afternoon, not just the count (older
  // requests from before halfDayPeriod existed fall back to a plain "ครึ่งวัน").
  if (r.halfDay) return `ครึ่งวัน${r.halfDayPeriod ? ` (${HALF_DAY_PERIOD_LABEL[r.halfDayPeriod]})` : ""}`;
  return `${r.days} วัน`;
}

export function LeaveView({ defaultTab = "me" }: { defaultTab?: "me" | "approvals" }) {
  const { canAny, user } = useAuth();
  // An account with no employee record (e.g. a pure admin) has no requests of
  // its own; open on the team queue instead of an empty/error "mine" tab.
  const hasEmployee = !!user.employee;
  const canApprove = canAny(["leave:approve", "leave:manage"]);

  return (
    <Tabs defaultValue={canApprove ? (hasEmployee ? defaultTab : "approvals") : "me"} className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">คำขอของฉัน</TabsTrigger>
        {canApprove && <TabsTrigger value="approvals">รออนุมัติ</TabsTrigger>}
      </TabsList>

      <TabsContent value="me" className="space-y-5">
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
  const { user } = useAuth();
  const hasEmployee = !!user.employee;
  const { data, isLoading, isError, refetch } = useLeave("me", undefined, { enabled: hasEmployee });
  const cancelMut = useCancelLeave();
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);
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

  if (!hasEmployee) {
    return (
      <EmptyState
        icon={UserRoundX}
        title="บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน"
        description="จึงไม่มีประวัติการลาของตัวเอง ดูและอนุมัติคำขอของทีมได้ที่แท็บ รออนุมัติ"
      />
    );
  }

  return (
    <>
      <BalanceCards />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">ประวัติการลา</h2>
        <Button render={<Link href="/leave/new" />}>
          <Plus className="size-4" /> ขอลา
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : requests.length === 0 ? (
        <EmptyState icon={CalendarDays} title="ยังไม่มีคำขอลา" description="เริ่มต้นด้วยการยื่นคำขอลา" />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
              <Link href={`/leave/${r.id}`} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{LEAVE_TYPE_LABEL[r.type]}</span>
                    <LeaveStatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {dateRange(r)} · {amountLabel(r)}{r.reason ? ` · ${r.reason}` : ""}
                  </p>
                </div>
              </Link>
              {(r.status === "PENDING" || r.status === "APPROVED") && (
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
        title="ยกเลิกคำขอลา"
        description={cancelTarget ? `ต้องการยกเลิกคำขอ${LEAVE_TYPE_LABEL[cancelTarget.type]} (${dateRange(cancelTarget)}) ใช่หรือไม่?` : undefined}
        destructive
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ปิด"
        loading={cancelMut.isPending}
        onConfirm={confirmCancel}
      />
    </>
  );
}

function Approvals() {
  const { data, isLoading, isError, refetch } = useLeave("team", "PENDING");
  const decideMut = useDecideLeave();
  const requests = data?.data ?? [];

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
  if (requests.length === 0) {
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอลาของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <Link href={`/leave/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-9">
              {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
              <AvatarFallback className="bg-transparent p-0">
                <CharacterAvatar character={characterFor({ gender: r.employee.gender ?? null })} seed={r.employee.id} className="size-full" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {displayName(r.employee)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {LEAVE_TYPE_LABEL[r.type]} · {dateRange(r)} · {amountLabel(r)}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={decideMut.isPending}
              onClick={() => decide(r.id, "reject")}
            >
              <X className="size-4" /> ไม่อนุมัติ
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
