"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Check, X, GitBranch, Pencil, Trash2, Send, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState, ErrorState, NoEmployeeState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

import { RequestStatusBadge, STEP_DOT } from "./labels";
import {
  useRequests,
  useWorkflows,
  useDecideRequest,
  useCancelRequest,
  useDeleteWorkflow,
} from "./hooks";
import type { ApprovalRequest, ApprovalWorkflow } from "./types";

function Stepper({ req }: { req: ApprovalRequest }) {
  return (
    <ol className="space-y-1">
      {req.steps.map((s, i) => {
        const isCurrent = req.status === "PENDING" && i === req.currentStep;
        return (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", STEP_DOT[s.status])} />
            <div className="min-w-0">
              <span className={cn("font-medium", isCurrent && "text-primary")}>
                {i + 1}. {s.name}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">({s.approverRole})</span>
              {s.decidedByName && (
                <span className="ml-1 text-xs text-muted-foreground">
                  · {s.status === "APPROVED" ? "อนุมัติโดย" : "ไม่อนุมัติโดย"} {s.decidedByName}
                  {s.note ? ` — ${s.note}` : ""}
                </span>
              )}
              {isCurrent && <span className="ml-1 text-xs text-primary">· กำลังรอ</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function RequestTable({
  requests,
  showRequester,
  renderActions,
}: {
  requests: ApprovalRequest[];
  showRequester?: boolean;
  renderActions: (req: ApprovalRequest) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 text-center">ลำดับ</TableHead>
          <TableHead>วันที่ส่ง</TableHead>
          <TableHead className="w-full">เรื่อง</TableHead>
          <TableHead>เวิร์กโฟลว์</TableHead>
          {showRequester && <TableHead>ผู้ขอ</TableHead>}
          <TableHead className="text-right">จำนวนเงิน</TableHead>
          <TableHead>ขั้นตอนอนุมัติ</TableHead>
          <TableHead className="text-center">สถานะ</TableHead>
          <TableHead className="text-center">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((r, i) => (
          <TableRow key={r.id}>
            <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
            <TableCell className="tabular-nums">{formatDate(r.createdAt)}</TableCell>
            <TableCell className="min-w-48 whitespace-normal">
              <Link href={`/workflows/requests/${r.id}`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                {r.title}
              </Link>
              {r.detail && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.detail}</p>}
            </TableCell>
            <TableCell>{r.workflowName}</TableCell>
            {showRequester && <TableCell>{r.requesterName}</TableCell>}
            <TableCell className="text-right tabular-nums">{r.amount != null ? formatCurrency(r.amount) : "-"}</TableCell>
            <TableCell className="min-w-56 whitespace-normal">
              <Stepper req={r} />
            </TableCell>
            <TableCell className="text-center">
              <RequestStatusBadge status={r.status} />
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1">{renderActions(r)}</div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorkflowView() {
  const { can } = useAuth();
  const canManage = can("workflow:create");
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "inbox" ? "inbox" : "me";

  return (
    <Tabs defaultValue={defaultTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="me">คำขอของฉัน</TabsTrigger>
        <TabsTrigger value="inbox">รอฉันอนุมัติ</TabsTrigger>
        {canManage && <TabsTrigger value="templates">เทมเพลต</TabsTrigger>}
      </TabsList>

      <TabsContent value="me">
        <MyRequests />
      </TabsContent>
      <TabsContent value="inbox">
        <InboxRequests />
      </TabsContent>
      {canManage && (
        <TabsContent value="templates">
          <Templates />
        </TabsContent>
      )}
    </Tabs>
  );
}

function MyRequests() {
  const hasEmployee = !!useAuth().user.employee;
  const { data, isLoading, isError, error, refetch } = useRequests("me");
  const cancelMut = useCancelRequest();
  const requests = data?.data ?? [];

  async function cancel(id: string) {
    try {
      await cancelMut.mutateAsync(id);
      toast.success("ยกเลิกคำขอแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">คำขอของฉัน</h2>
        {hasEmployee && (
          <Button render={<Link href="/workflows/requests/new" />}>
            <Send className="size-4" /> ส่งคำขอ
          </Button>
        )}
      </div>
      {!hasEmployee ? (
        <NoEmployeeState />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : requests.length === 0 ? (
        <EmptyState icon={Send} title="ยังไม่มีคำขอ" description="ส่งคำขออนุมัติตามเวิร์กโฟลว์ที่กำหนดไว้" />
      ) : (
        <RequestTable
          requests={requests}
          renderActions={(r) =>
            r.status === "PENDING" ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancel(r.id)}>
                ยกเลิกคำขอ
              </Button>
            ) : null
          }
        />
      )}
    </div>
  );
}

function InboxRequests() {
  const { data, isLoading, isError, refetch } = useRequests("inbox");
  const decideMut = useDecideRequest();
  const requests = data?.data ?? [];

  async function decide(id: string, action: "approve" | "reject") {
    try {
      await decideMut.mutateAsync({ id, action });
      toast.success(action === "approve" ? "อนุมัติแล้ว" : "ไม่อนุมัติแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={3} />;
  if (requests.length === 0) {
    return <EmptyState icon={Inbox} title="ไม่มีคำขอรออนุมัติ" description="คำขอที่รอบทบาทของคุณอนุมัติจะแสดงที่นี่" />;
  }

  return (
    <RequestTable
      requests={requests}
      showRequester
      renderActions={(r) => (
        <>
          <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "reject")}>
            <X className="size-4" /> ไม่อนุมัติ
          </Button>
          <Button size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "approve")}>
            <Check className="size-4" /> อนุมัติ
          </Button>
        </>
      )}
    />
  );
}

function Templates() {
  const { data, isLoading, isError, refetch } = useWorkflows(false);
  const deleteMut = useDeleteWorkflow();
  const workflows = data?.data ?? [];

  const [delTarget, setDelTarget] = useState<ApprovalWorkflow | null>(null);

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deleteMut.mutateAsync(delTarget.id);
      toast.success("ลบเวิร์กโฟลว์แล้ว");
      setDelTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">เวิร์กโฟลว์อนุมัติ</h2>
        <Button render={<Link href="/workflows/new" />}>
          <Plus className="size-4" /> สร้างเวิร์กโฟลว์
        </Button>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : workflows.length === 0 ? (
        <EmptyState icon={GitBranch} title="ยังไม่มีเวิร์กโฟลว์" description="สร้างสายอนุมัติแบบหลายขั้นตามที่องค์กรต้องการ" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">ลำดับ</TableHead>
              <TableHead className="w-full">ชื่อเวิร์กโฟลว์</TableHead>
              <TableHead>สายอนุมัติ</TableHead>
              <TableHead className="text-center">สถานะ</TableHead>
              <TableHead className="text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((w, i) => (
              <TableRow key={w.id}>
                <TableCell className="text-center tabular-nums">{i + 1}</TableCell>
                <TableCell className="min-w-48 whitespace-normal">
                  <Link href={`/workflows/${w.id}/edit`} className="font-medium break-words text-foreground hover:text-primary hover:underline">
                    {w.name}
                  </Link>
                  {w.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{w.description}</p>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {w.steps.map((st, si) => (
                      <span key={si} className="rounded bg-muted px-1.5 py-0.5">
                        <span className="tabular-nums">{si + 1}.</span> {st.approverRole}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <StatusChip tone={w.active ? "success" : "neutral"} label={w.active ? "ใช้งาน" : "ปิดใช้งาน"} />
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="size-9" render={<Link href={`/workflows/${w.id}/edit`} />} aria-label={`แก้ไข ${w.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-9 text-destructive" onClick={() => setDelTarget(w)} aria-label={`ลบ ${w.name}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="ลบเวิร์กโฟลว์?"
        description={delTarget?.name}
        confirmLabel="ลบ"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
