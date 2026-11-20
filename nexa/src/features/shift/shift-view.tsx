"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Repeat, Check, Ban } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { useAuth } from "@/features/auth/auth-context";
import { useOrgOptions } from "@/features/employee/hooks";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

import {
  useTemplates,
  useAssignments,
  useMyAssignments,
  useUpsertAssignment,
  useDeleteAssignment,
  useDeleteTemplate,
  useCreateSwapRequest,
  useSwapRequests,
  useDecideSwapRequest,
  useCancelSwapRequest,
} from "./hooks";
import type { ShiftTemplate, ShiftAssignment, SwapRequest } from "./types";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIsoLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function thisWeekStart() {
  const now = new Date();
  return toIsoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()));
}
function shiftWeek(weekStart: string, deltaDays: number) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function ShiftView() {
  const { can } = useAuth();
  const canAssign = can("shift:create");
  const [tab, setTab] = useState("mine");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="space-y-4">
      <TabsList>
        <TabsTrigger value="mine">ตารางของฉัน</TabsTrigger>
        <TabsTrigger value="swap">คำขอสลับเวร</TabsTrigger>
        {canAssign && <TabsTrigger value="roster">จัดตาราง</TabsTrigger>}
      </TabsList>
      <TabsContent value="mine">
        <MyScheduleView onGoRoster={canAssign ? () => setTab("roster") : undefined} />
      </TabsContent>
      <TabsContent value="swap">
        <SwapRequestsView />
      </TabsContent>
      {canAssign && (
        <TabsContent value="roster">
          <RosterGrid />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyScheduleView({ onGoRoster }: { onGoRoster?: () => void }) {
  const hasEmployee = !!useAuth().user.employee;
  const today = toIsoLocal(new Date());
  const to = shiftWeek(today, 6);
  const { data, isLoading, isError, error, refetch } = useMyAssignments(today, to);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftWeek(today, i)), [today]);

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftAssignment>();
    for (const a of data?.data ?? []) map.set(a.date, a);
    return map;
  }, [data]);

  if (!hasEmployee) {
    return (
      <NoEmployeeState
        action={
          onGoRoster ? (
            <Button variant="outline" onClick={onGoRoster}>
              ไปที่จัดตาราง เพื่อจัดกะให้พนักงาน
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;

  return (
    <>
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">No.</TableHead>
            <TableHead>วันที่</TableHead>
            <TableHead>เวร</TableHead>
            <TableHead className="w-full">เวลา</TableHead>
            <TableHead className="text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((d, i) => {
            const cell = byDate.get(d);
            const tpl = cell?.template;
            const isToday = d === today;
            return (
              <TableRow key={d} className={cn(isToday && "bg-primary/5")}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium tabular-nums">
                  {WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} {d.slice(8)} {thaiMonth(d)}
                  {isToday && <span className="ml-1.5 text-primary">(วันนี้)</span>}
                </TableCell>
                <TableCell>
                  {tpl ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium text-white"
                      style={{ backgroundColor: tpl.color }}
                    >
                      {tpl.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">ไม่มีเวร</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{tpl ? `${tpl.startTime}-${tpl.endTime}` : "-"}</TableCell>
                <TableCell className="text-center">{cell ? <RequestSwapButton assignment={cell} /> : null}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    <div className="space-y-2 md:hidden">
      {days.map((d) => {
        const cell = byDate.get(d);
        const tpl = cell?.template;
        const isToday = d === today;
        return (
          <Card
            key={d}
            className={cn(
              "flex flex-row items-center justify-between gap-3 p-3",
              isToday && "border-primary/40 bg-primary/5",
            )}
          >
            <p className="text-sm font-medium text-foreground">
              {WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} {d.slice(8)} {thaiMonth(d)}
              {isToday && <span className="ml-1.5 text-sm text-primary">(วันนี้)</span>}
            </p>
            <div className="flex items-center gap-2">
              {tpl ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-white"
                  style={{ backgroundColor: tpl.color }}
                >
                  {tpl.name} · {tpl.startTime}-{tpl.endTime}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">ไม่มีเวร</span>
              )}
              {cell && <RequestSwapButton assignment={cell} />}
            </div>
          </Card>
        );
      })}
    </div>
    </>
  );
}

function RequestSwapButton({ assignment }: { assignment: ShiftAssignment }) {
  const { user } = useAuth();
  const myEmployeeId = user.employee?.id ?? null;
  const { data: orgData } = useOrgOptions();
  const coworkers = (orgData?.data.managers ?? []).filter((e) => e.id !== myEmployeeId);

  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const createMut = useCreateSwapRequest();

  async function submit() {
    if (!targetId) {
      toast.error("กรุณาเลือกเพื่อนร่วมงาน");
      return;
    }
    try {
      await createMut.mutateAsync({
        assignmentId: assignment.id,
        targetEmployeeId: targetId,
        reason: reason.trim() || undefined,
      });
      toast.success("ส่งคำขอสลับเวรแล้ว");
      setOpen(false);
      setTargetId("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ส่งคำขอไม่สำเร็จ");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon-sm" aria-label="ขอสลับเวร" onClick={() => setOpen(true)}>
        <Repeat className="size-3.5" />
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ขอสลับเวร</DialogTitle>
          <DialogDescription>
            {formatDate(assignment.date)} · {assignment.template.name} ({assignment.template.startTime}-
            {assignment.template.endTime})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกเพื่อนร่วมงานที่จะให้ทำแทน" />
            </SelectTrigger>
            <SelectContent>
              {coworkers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={2}
            placeholder="เหตุผล (ไม่บังคับ)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button className="w-full" onClick={submit} disabled={createMut.isPending}>
            ส่งคำขอ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SWAP_STATUS_LABEL: Record<SwapRequest["status"], string> = {
  PENDING: "รออนุมัติ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  CANCELLED: "ยกเลิกแล้ว",
};
const SWAP_STATUS_TONE: Record<SwapRequest["status"], string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

function SwapRequestRow({
  req,
  children,
}: {
  req: SwapRequest;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-row flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {req.requesterEmployee.firstName} {req.requesterEmployee.lastName} → {req.targetEmployee.firstName}{" "}
          {req.targetEmployee.lastName}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDate(req.assignment.date)} · {req.assignment.template.name}
          {req.reason && <> · {req.reason}</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-sm font-medium", SWAP_STATUS_TONE[req.status])}>
          {SWAP_STATUS_LABEL[req.status]}
        </span>
        {children}
      </div>
    </Card>
  );
}

const SWAP_CHIP_TONE: Record<SwapRequest["status"], StatusTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/** Swap requests as a table on desktop and the existing cards on phones. */
function SwapRequestList({ rows, actions }: { rows: SwapRequest[]; actions: (req: SwapRequest) => React.ReactNode }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">No.</TableHead>
              <TableHead>ผู้ขอ</TableHead>
              <TableHead>ให้ทำแทน</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>กะ</TableHead>
              <TableHead className="w-full">เหตุผล</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((req, i) => (
              <TableRow key={req.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">
                  {req.requesterEmployee.firstName} {req.requesterEmployee.lastName}
                </TableCell>
                <TableCell>
                  {req.targetEmployee.firstName} {req.targetEmployee.lastName}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(req.assignment.date)}</TableCell>
                <TableCell>{req.assignment.template.name}</TableCell>
                <TableCell className="whitespace-normal break-words text-muted-foreground">{req.reason || "-"}</TableCell>
                <TableCell className="text-center">
                  <StatusChip tone={SWAP_CHIP_TONE[req.status]} label={SWAP_STATUS_LABEL[req.status]} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">{actions(req)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((req) => (
          <SwapRequestRow key={req.id} req={req}>
            {actions(req)}
          </SwapRequestRow>
        ))}
      </div>
    </>
  );
}

function SwapRequestsView() {
  const swapHasEmployee = !!useAuth().user.employee;
  const mineQuery = useSwapRequests("mine");
  const inboxQuery = useSwapRequests("inbox");
  const cancelMut = useCancelSwapRequest();
  const decideMut = useDecideSwapRequest();

  async function cancel(id: string) {
    try {
      await cancelMut.mutateAsync(id);
      toast.success("ยกเลิกคำขอแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await decideMut.mutateAsync({ id, action });
      toast.success(action === "approve" ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (!swapHasEmployee) return <NoEmployeeState />;
  const mine = mineQuery.data?.data ?? [];
  const inbox = inboxQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">คำขอของฉัน</h3>
        {mineQuery.isError ? (
          <ErrorState error={mineQuery.error} onRetry={() => mineQuery.refetch()} />
        ) : mineQuery.isLoading ? (
          <TableLoadingState rows={2} />
        ) : mine.length === 0 ? (
          <EmptyState icon={Repeat} title="ยังไม่มีคำขอสลับเวร" />
        ) : (
          <SwapRequestList
            rows={mine}
            actions={(req) =>
              req.status === "PENDING" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={cancelMut.isPending}
                  onClick={() => cancel(req.id)}
                >
                  ยกเลิก
                </Button>
              )
            }
          />
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">รออนุมัติ</h3>
        {inboxQuery.isError ? (
          <ErrorState error={inboxQuery.error} onRetry={() => inboxQuery.refetch()} />
        ) : inboxQuery.isLoading ? (
          <TableLoadingState rows={2} />
        ) : inbox.length === 0 ? (
          <EmptyState icon={Repeat} title="ไม่มีคำขอรออนุมัติ" />
        ) : (
          <SwapRequestList
            rows={inbox}
            actions={(req) => (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="อนุมัติ"
                  disabled={decideMut.isPending}
                  onClick={() => decide(req.id, "approve")}
                >
                  <Check className="size-4 text-success" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="ไม่อนุมัติ"
                  disabled={decideMut.isPending}
                  onClick={() => decide(req.id, "reject")}
                >
                  <Ban className="size-4 text-destructive" />
                </Button>
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}

function RosterGrid() {
  const { can } = useAuth();
  const canAssign = can("shift:create");
  const canEditTpl = can("shift:update");
  const canDelTpl = can("shift:delete");

  const [weekStart, setWeekStart] = useState(thisWeekStart());
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftWeek(weekStart, i)),
    [weekStart],
  );
  const weekEnd = days[6];

  const { data: tplData } = useTemplates();
  const templates = tplData?.data ?? [];
  const { data: orgData } = useOrgOptions();
  const employees = orgData?.data.managers ?? [];
  const { data: asgData, isLoading, isError, refetch } = useAssignments(weekStart, weekEnd);

  const upsertMut = useUpsertAssignment();
  const deleteAsgMut = useDeleteAssignment();
  const deleteTplMut = useDeleteTemplate();

  const [delTpl, setDelTpl] = useState<ShiftTemplate | null>(null);

  const asgMap = useMemo(() => {
    const map = new Map<string, ShiftAssignment>();
    for (const a of asgData?.data ?? []) {
      map.set(`${a.employeeId}|${a.date}`, a);
    }
    return map;
  }, [asgData]);

  const label = `${days[0].slice(8)}–${days[6].slice(8)} ${thaiMonth(days[6])} ${Number(days[6].slice(0, 4)) + 543}`;

  async function assign(employeeId: string, date: string, templateId: string) {
    try {
      await upsertMut.mutateAsync({ employeeId, date, templateId });
    } catch {
      toast.error("มอบหมายเวรไม่สำเร็จ");
    }
  }
  async function clearCell(id: string) {
    try {
      await deleteAsgMut.mutateAsync(id);
    } catch {
      toast.error("ลบเวรไม่สำเร็จ");
    }
  }
  async function confirmDelTpl() {
    if (!delTpl) return;
    try {
      await deleteTplMut.mutateAsync(delTpl.id);
      toast.success("ลบกะแล้ว");
      setDelTpl(null);
    } catch {
      toast.error("ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {/* Template strip */}
      <Card className="flex flex-row flex-wrap items-center gap-2 p-3">
        <span className="text-sm font-medium text-muted-foreground">กะ:</span>
        {templates.length === 0 && (
          <span className="text-sm text-muted-foreground">ยังไม่มีกะ — สร้างกะเพื่อเริ่มจัดตาราง</span>
        )}
        {templates.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-0.5 pl-3 text-sm"
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="font-medium">{t.name}</span>
            <span className="text-muted-foreground">
              {t.startTime}–{t.endTime}
            </span>
            {canEditTpl && (
              <Link
                href={`/shifts/templates/${t.id}/edit`}
                className="ml-0.5 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground max-md:size-11"
                aria-label="แก้ไขกะ"
                title="แก้ไขกะ"
              >
                <Pencil className="size-4" />
              </Link>
            )}
            {canDelTpl && (
              <button
                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive-muted hover:text-destructive max-md:size-11"
                onClick={() => setDelTpl(t)}
                aria-label="ลบกะ"
                title="ลบกะ"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </span>
        ))}
        {canEditTpl && (
          <Button variant="outline" size="sm" className="ml-auto h-9 max-md:h-11" render={<Link href="/shifts/templates/new" />}>
            <Plus className="size-3.5" /> สร้างกะ
          </Button>
        )}
      </Card>

      {/* Week nav */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, -7))} aria-label="สัปดาห์ก่อน">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-44 text-center text-sm font-semibold">{label}</span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(shiftWeek(weekStart, 7))} aria-label="สัปดาห์ถัดไป">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeekStart())}>
          สัปดาห์นี้
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={6} />
      ) : (
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-40 bg-card">
                  พนักงาน
                </TableHead>
                {days.map((d) => (
                  <TableHead key={d} className="min-w-28 text-center">
                    <div className="text-sm text-muted-foreground">
                      {WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}
                    </div>
                    <div>{d.slice(8)}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium">
                    {emp.firstName} {emp.lastName}
                    <span className="ml-1 text-sm text-muted-foreground">({emp.employeeCode})</span>
                  </TableCell>
                  {days.map((d) => {
                    const cell = asgMap.get(`${emp.id}|${d}`);
                    const tpl = cell?.template;
                    return (
                      <TableCell key={d} className="p-1 text-center">
                        {canAssign ? (
                          <Popover>
                            <PopoverTrigger
                              render={
                                <button
                                  className={cn(
                                    "flex min-h-11 w-full items-center justify-center rounded-md border px-1 py-1 text-sm leading-snug break-words transition",
                                    tpl
                                      ? "border-transparent font-medium text-white"
                                      : "border-dashed border-border text-muted-foreground hover:border-primary",
                                  )}
                                  style={tpl ? { backgroundColor: tpl.color } : undefined}
                                >
                                  {tpl ? tpl.name : "+"}
                                </button>
                              }
                            />
                            <PopoverContent align="center" className="w-48 p-1.5">
                              <p className="px-2 py-1 text-sm text-muted-foreground">เลือกกะ</p>
                              <div className="space-y-0.5">
                                {templates.map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => assign(emp.id, d, t.id)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                  >
                                    <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                    {t.name}
                                    <span className="ml-auto text-sm text-muted-foreground">
                                      {t.startTime}
                                    </span>
                                  </button>
                                ))}
                                {templates.length === 0 && (
                                  <p className="px-2 py-1.5 text-sm text-muted-foreground">ยังไม่มีกะ</p>
                                )}
                                {cell && (
                                  <button
                                    onClick={() => clearCell(cell.id)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="size-3.5" /> ลบเวร
                                  </button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div
                            className={cn(
                              "flex min-h-11 w-full items-center justify-center rounded-md px-1 py-1 text-sm leading-snug break-words",
                              tpl ? "font-medium text-white" : "text-muted-foreground",
                            )}
                            style={tpl ? { backgroundColor: tpl.color } : undefined}
                          >
                            {tpl ? tpl.name : "—"}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    ยังไม่มีพนักงาน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
      )}

      <ConfirmDialog
        open={!!delTpl}
        onOpenChange={(o) => !o && setDelTpl(null)}
        title="ลบกะการทำงาน?"
        description={delTpl ? `การลบ “${delTpl.name}” จะลบเวรที่มอบหมายด้วยกะนี้ทั้งหมด` : undefined}
        confirmLabel="ลบ"
        destructive
        loading={deleteTplMut.isPending}
        onConfirm={confirmDelTpl}
      />
    </div>
  );
}

const THAI_MONTHS = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
function thaiMonth(iso: string) {
  return THAI_MONTHS[Number(iso.slice(5, 7)) - 1];
}
