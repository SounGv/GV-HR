"use client";

import { useState } from "react";
import { Plus, Check, X, GitBranch, Pencil, Trash2, Send, Inbox } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";

import { WorkflowDialog } from "./workflow-dialog";
import { RequestDialog } from "./request-dialog";
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
    <ol className="mt-2 space-y-1.5">
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
                  · {s.status === "APPROVED" ? "อนุมัติโดย" : "ปฏิเสธโดย"} {s.decidedByName}
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

function RequestCard({
  req,
  showRequester,
  actions,
}: {
  req: ApprovalRequest;
  showRequester?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{req.title}</span>
            <RequestStatusBadge status={req.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {req.workflowName}
            {showRequester ? ` · ${req.requesterName}` : ""}
            {req.amount != null ? ` · ${formatCurrency(req.amount)}` : ""}
            {` · ${formatDate(req.createdAt)}`}
          </p>
          {req.detail && <p className="mt-1 text-sm text-muted-foreground">{req.detail}</p>}
          <Stepper req={req} />
        </div>
      </div>
      {actions && <div className="mt-3 flex items-center justify-end gap-2">{actions}</div>}
    </Card>
  );
}

export function WorkflowView() {
  const { can } = useAuth();
  const canManage = can("workflow:create");

  return (
    <Tabs defaultValue="me" className="space-y-4">
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
  const { data, isLoading, isError, refetch } = useRequests("me");
  const cancelMut = useCancelRequest();
  const [dialogOpen, setDialogOpen] = useState(false);
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
        <Button onClick={() => setDialogOpen(true)}>
          <Send className="size-4" /> ส่งคำขอ
        </Button>
      </div>
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <TableLoadingState rows={3} />
      ) : requests.length === 0 ? (
        <EmptyState icon={Send} title="ยังไม่มีคำขอ" description="ส่งคำขออนุมัติตามเวิร์กโฟลว์ที่กำหนดไว้" />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              actions={
                r.status === "PENDING" ? (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancel(r.id)}>
                    ยกเลิกคำขอ
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
      <RequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
      toast.success(action === "approve" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
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
    <div className="space-y-3">
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          req={r}
          showRequester
          actions={
            <>
              <Button variant="outline" size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "reject")}>
                <X className="size-4" /> ปฏิเสธ
              </Button>
              <Button size="sm" disabled={decideMut.isPending} onClick={() => decide(r.id, "approve")}>
                <Check className="size-4" /> อนุมัติ
              </Button>
            </>
          }
        />
      ))}
    </div>
  );
}

function Templates() {
  const { data, isLoading, isError, refetch } = useWorkflows(false);
  const deleteMut = useDeleteWorkflow();
  const workflows = data?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalWorkflow | null>(null);
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
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
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
        <div className="grid gap-3 md:grid-cols-2">
          {workflows.map((w) => (
            <Card key={w.id} className="gap-0 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{w.name}</span>
                    {!w.active && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        ปิดใช้งาน
                      </span>
                    )}
                  </div>
                  {w.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => {
                      setEditing(w);
                      setDialogOpen(true);
                    }}
                    aria-label="แก้ไข"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => setDelTarget(w)}
                    aria-label="ลบ"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {w.steps.map((s, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground/50">→</span>}
                    <span className="rounded bg-muted px-1.5 py-0.5">{s.approverRole}</span>
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <WorkflowDialog open={dialogOpen} onOpenChange={setDialogOpen} workflow={editing} />
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
