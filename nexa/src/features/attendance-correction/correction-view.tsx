"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, X, Clock3 } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CharacterAvatar, characterFor } from "@/components/shared/character-avatar";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatDate, displayName } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import { LeaveStatusBadge } from "@/features/leave/labels";

import { useAttendanceCorrections, useCancelAttendanceCorrection, useDecideAttendanceCorrection } from "./hooks";
import type { AttendanceCorrectionRequest } from "./types";

function fmtTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );
}

function line(r: AttendanceCorrectionRequest) {
  const parts = [formatDate(r.workDate)];
  if (r.requestedClockIn) parts.push(`เข้า ${fmtTime(r.requestedClockIn)}`);
  if (r.requestedClockOut) parts.push(`ออก ${fmtTime(r.requestedClockOut)}`);
  return parts.join(" · ");
}

export function CorrectionView() {
  const { canAny } = useAuth();
  const canApprove = canAny(["attendance:approve", "attendance:manage"]);

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
  const hasEmployee = !!useAuth().user.employee;
  const { data, isLoading, isError, error, refetch } = useAttendanceCorrections("me");
  const cancelMut = useCancelAttendanceCorrection();
  const [cancelTarget, setCancelTarget] = useState<AttendanceCorrectionRequest | null>(null);
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
        <h2 className="text-sm font-semibold text-foreground">ประวัติคำขอแก้ไขเวลา</h2>
        {hasEmployee && (
          <Button render={<Link href="/attendance/corrections/new" />}>
            <Plus className="size-4" /> แก้ไขเวลา
          </Button>
        )}
      </div>

      {!hasEmployee ? (
        <NoEmployeeState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={4} />
      ) : requests.length === 0 ? (
        <EmptyState icon={Clock3} title="ยังไม่มีคำขอแก้ไขเวลา" description="ส่งคำขอเมื่อลืมลงเวลาเข้างาน-เอาท์ หรือเวลาผิดพลาด" />
      ) : (
        <>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-center">ลำดับ</TableHead>
                <TableHead>วันที่ทำงาน</TableHead>
                <TableHead>เวลาเข้า</TableHead>
                <TableHead>เวลาออก</TableHead>
                <TableHead className="w-full">เหตุผล</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                  <TableCell className="tabular-nums">
                    <Link href={`/attendance/corrections/${r.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {formatDate(r.workDate)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.requestedClockIn) ?? "-"}</TableCell>
                  <TableCell className="tabular-nums">{fmtTime(r.requestedClockOut) ?? "-"}</TableCell>
                  <TableCell className="whitespace-normal break-words text-muted-foreground">{r.reason || "-"}</TableCell>
                  <TableCell className="text-center">
                    <LeaveStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-center">
                    {r.status === "PENDING" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-destructive"
                        aria-label={`ยกเลิกคำขอแก้ไขเวลา ${formatDate(r.workDate)}`}
                        title="ยกเลิกคำขอ"
                        onClick={() => setCancelTarget(r)}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-2 md:hidden">
          {requests.map((r) => (
            <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
              <Link href={`/attendance/corrections/${r.id}`} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">แก้ไขเวลาเข้า-ออกงาน</span>
                    <LeaveStatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{line(r)}</p>
                </div>
              </Link>
              {r.status === "PENDING" && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(r)}>
                  ยกเลิก
                </Button>
              )}
            </Card>
          ))}
        </div>
        </>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="ยกเลิกคำขอแก้ไขเวลา"
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
  const { data, isLoading, isError, refetch } = useAttendanceCorrections("team", "PENDING");
  const decideMut = useDecideAttendanceCorrection();
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
    return <EmptyState icon={Check} title="ไม่มีคำขอรออนุมัติ" description="คำขอแก้ไขเวลาของทีมที่รอการอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <>
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">ลำดับ</TableHead>
            <TableHead>ผู้ขอ</TableHead>
            <TableHead>วันที่ทำงาน</TableHead>
            <TableHead>เวลาเข้า</TableHead>
            <TableHead>เวลาออก</TableHead>
            <TableHead className="w-full">เหตุผล</TableHead>
            <TableHead className="text-center">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r, i) => (
            <TableRow key={r.id}>
              <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
              <TableCell>
                <Link href={`/attendance/corrections/${r.id}`} className="flex items-center gap-2 font-medium text-foreground hover:text-primary hover:underline">
                  <Avatar className="size-8">
                    {r.employee.avatarUrl && <AvatarImage src={r.employee.avatarUrl} alt={r.employee.firstName} />}
                    <AvatarFallback className="bg-transparent p-0">
                      <CharacterAvatar character={characterFor({ gender: r.employee.gender ?? null })} seed={r.employee.id} className="size-full" />
                    </AvatarFallback>
                  </Avatar>
                  {displayName(r.employee)}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">{formatDate(r.workDate)}</TableCell>
              <TableCell className="tabular-nums">{fmtTime(r.requestedClockIn) ?? "-"}</TableCell>
              <TableCell className="tabular-nums">{fmtTime(r.requestedClockOut) ?? "-"}</TableCell>
              <TableCell className="whitespace-normal break-words text-muted-foreground">{r.reason || "-"}</TableCell>
              <TableCell>
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
    </div>
    <div className="space-y-2 md:hidden">
      {requests.map((r) => (
        <Card key={r.id} className="flex-row items-center justify-between gap-3 p-4">
          <Link href={`/attendance/corrections/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
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
                {line(r)}
                {r.reason ? ` · ${r.reason}` : ""}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "reject")}>
              <X className="size-4" /> ไม่อนุมัติ
            </Button>
            <Button size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "approve")}>
              <Check className="size-4" /> อนุมัติ
            </Button>
          </div>
        </Card>
      ))}
    </div>
    </>
  );
}
