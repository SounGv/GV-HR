"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { useAuth } from "@/features/auth/auth-context";
import { displayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KIND_LABEL, RejectDialog, detailHref, itemLine, useApprovalQueue, type ReqItem } from "./approval-queue";

type Filter = "all" | ReqItem["kind"];

const KIND_TONE: Record<ReqItem["kind"], string> = {
  leave: "border-border bg-surface-muted text-foreground",
  ot: "border-border bg-surface-muted text-foreground",
  correction: "border-border bg-surface-muted text-foreground",
};

const DAY_MS = 86_400_000;

/** Whole days a request has been waiting (0 = sent today). */
function waitingDays(createdAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / DAY_MS));
}

/**
 * Desktop approvals: every pending leave / OT / time-correction request the
 * user can decide, oldest first, each with approve and reject right in the
 * row so a manager can clear the queue without opening each request.
 */
export function ApprovalsDesk() {
  const { canAny } = useAuth();
  const canApprove = canAny(["leave:approve", "leave:manage", "overtime:approve", "overtime:manage", "attendance:approve", "attendance:manage"]);
  const q = useApprovalQueue();
  const [filter, setFilter] = useState<Filter>("all");
  // Read once per render pass; the list refreshes after every decision anyway.
  const [now] = useState(() => Date.now());

  const sorted = useMemo(
    () => [...q.items].sort((a, b) => new Date(a.request.createdAt).getTime() - new Date(b.request.createdAt).getTime()),
    [q.items],
  );
  const counts = useMemo(() => {
    const c = { leave: 0, ot: 0, correction: 0 };
    for (const i of q.items) c[i.kind]++;
    return c;
  }, [q.items]);
  const stale = q.items.filter((i) => waitingDays(i.request.createdAt, now) >= 2).length;
  const shown = filter === "all" ? sorted : sorted.filter((i) => i.kind === filter);

  if (!canApprove) return null;

  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "ทั้งหมด", n: q.items.length },
    { key: "leave", label: "การลา", n: counts.leave },
    { key: "ot", label: "OT", n: counts.ot },
    { key: "correction", label: "แก้ไขเวลา", n: counts.correction },
  ];

  return (
    <section aria-label="คำขอรออนุมัติ" className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <h2 className="text-[15px] leading-snug font-semibold">คำขอรออนุมัติ</h2>
          <p className="text-xs text-muted-foreground">เรียงจากรายการที่รอนานที่สุด อนุมัติหรือไม่อนุมัติได้จากแถวนี้เลย</p>
        </div>
        <span aria-hidden="true" className="mb-2 h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองตามประเภท">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                aria-pressed={filter === c.key}
                className={cn(
                  "h-8 rounded-sm border px-3 text-[12.5px] font-medium transition-colors",
                  filter === c.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-[#b9c2c9]",
                )}
              >
                {c.label} <span className="tabular-nums">{c.n}</span>
              </button>
            ))}
          </div>
          {stale > 0 && (
            <span className="ml-auto rounded-sm border border-status-late-border bg-status-late-bg px-2.5 py-0.5 text-xs font-semibold text-status-late-fg">
              ค้างเกิน 2 วัน <span className="tabular-nums">{stale}</span> รายการ
            </span>
          )}
        </div>

        {q.allFailed ? (
          <div>
            <ErrorState onRetry={q.retryFailed} />
          </div>
        ) : q.isLoading ? (
          <div>
            <TableLoadingState rows={3} />
          </div>
        ) : shown.length === 0 && q.failed.length === 0 ? (
          <div>
            <EmptyState
              icon={Check}
              title={filter === "all" ? "ไม่มีคำขอรออนุมัติ" : `ไม่มีคำขอ${chips.find((c) => c.key === filter)?.label ?? ""}รออนุมัติ`}
              description="คำขอลา, OT และแก้ไขเวลาของทีมที่รอการอนุมัติจะแสดงที่นี่"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {q.failed.length > 0 && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-sm border border-border bg-status-late-bg px-4 py-2.5 text-sm">
                โหลดคำขอบางประเภทไม่สำเร็จ รายการด้านล่างอาจไม่ครบ
                <Button variant="outline" size="sm" onClick={q.retryFailed}>
                  ลองใหม่
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">ลำดับ</TableHead>
                  <TableHead>ผู้ขอ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="w-full">รายละเอียด</TableHead>
                  <TableHead>เหตุผล</TableHead>
                  <TableHead>รอมาแล้ว</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((item, i) => {
                  const key = `${item.kind}-${item.request.id}`;
                  const busy = q.busyKey === key;
                  const name = displayName(item.request.employee);
                  const days = waitingDays(item.request.createdAt, now);
                  const reason = item.request.reason?.trim();
                  return (
                    <TableRow key={key}>
                      <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <Link href={detailHref(item)} className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground hover:text-primary hover:underline">
                          <PersonAvatar name={name} gender={item.request.employee.gender ?? null} seed={item.request.employee.id} src={item.request.employee.avatarUrl} />
                          {name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className={cn("rounded-sm border px-2 py-px text-xs font-semibold", KIND_TONE[item.kind])}>
                          {KIND_LABEL[item.kind]}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal tabular-nums">{itemLine(item)}</TableCell>
                      <TableCell className="max-w-64 whitespace-normal break-words text-muted-foreground">{reason || "-"}</TableCell>
                      <TableCell className="tabular-nums">
                        {days >= 2 ? <span className="font-semibold text-status-late-fg">รอ {days} วัน</span> : days === 0 ? "วันนี้" : `${days} วัน`}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              q.setRejectReason("");
                              q.setRejectTarget(item);
                            }}
                            className="h-8 border-destructive/30 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            aria-label={`ไม่อนุมัติคำขอของ ${name}`}
                          >
                            <X /> ไม่อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => q.decide(item, "approve")}
                            className="h-8 px-3"
                            aria-label={`อนุมัติคำขอของ ${name}`}
                          >
                            {busy ? <Loader2 className="animate-spin motion-reduce:animate-[spin_2.5s_linear_infinite]" /> : <Check />} อนุมัติ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RejectDialog
        target={q.rejectTarget}
        reason={q.rejectReason}
        onReasonChange={q.setRejectReason}
        loading={q.rejectTarget ? q.busyKey === `${q.rejectTarget.kind}-${q.rejectTarget.request.id}` : false}
        onCancel={() => {
          q.setRejectTarget(null);
          q.setRejectReason("");
        }}
        onConfirm={q.confirmReject}
      />
    </section>
  );
}
