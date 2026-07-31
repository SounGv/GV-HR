"use client";

import { useState } from "react";
import { Plus, Target, Pencil, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/features/auth/auth-context";
import { fullName, getInitials, formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/client";

import { GoalDialog } from "./goal-dialog";
import { ProgressDialog } from "./progress-dialog";
import { GoalStatusBadge, GOAL_TYPE_LABEL } from "./labels";
import { useGoals, useDeleteGoal } from "./hooks";
import type { Goal, GoalScope } from "./types";

function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function KpiView() {
  const { can, user } = useAuth();
  const canManage = can("kpi:update");
  const canCreate = can("kpi:create");
  const canDelete = can("kpi:delete");
  const myEmployeeId = user.employee?.id ?? null;

  const [scope, setScope] = useState<GoalScope>("me");
  const { data, isLoading, isError, refetch } = useGoals(scope);
  const goals = data?.data ?? [];

  const deleteMut = useDeleteGoal();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(g: Goal) {
    setEditing(g);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("ลบเป้าหมายแล้ว");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Tabs value={scope} onValueChange={(v) => setScope((v as GoalScope) ?? "me")}>
          <TabsList>
            <TabsTrigger value="me">ของฉัน</TabsTrigger>
            {canManage && <TabsTrigger value="team">ทีมของฉัน</TabsTrigger>}
            {canManage && <TabsTrigger value="all">ทั้งหมด</TabsTrigger>}
          </TabsList>
        </Tabs>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            สร้างเป้าหมาย
          </Button>
        )}
      </div>

      <Tabs value={scope}>
        <TabsContent value={scope} className="mt-0">
          {isLoading ? (
            <TableLoadingState />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="ยังไม่มีเป้าหมาย"
              description={
                canCreate ? "เริ่มต้นด้วยการสร้างเป้าหมาย / KPI" : "ยังไม่มีการกำหนดเป้าหมายให้คุณ"
              }
              action={
                canCreate ? (
                  <Button onClick={openCreate} size="sm">
                    <Plus className="size-4" />
                    สร้างเป้าหมาย
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {goals.map((g) => {
                const pct = progressPercent(g.currentValue, g.targetValue);
                const isOwner = g.employee.id === myEmployeeId;
                return (
                  <Card key={g.id} className="gap-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {GOAL_TYPE_LABEL[g.type]}
                          </span>
                          <span className="text-xs text-muted-foreground">{g.cycle}</span>
                        </div>
                        <p className="font-medium leading-snug">{g.title}</p>
                        {g.description && (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {g.description}
                          </p>
                        )}
                      </div>
                      <GoalStatusBadge status={g.status} />
                    </div>

                    {scope !== "me" && (
                      <div className="mt-2 flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={g.employee.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(g.employee.firstName, g.employee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">
                          {fullName(g.employee.firstName, g.employee.lastName)}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {g.currentValue} / {g.targetValue} {g.unit}
                        </span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${
                            g.status === "AT_RISK"
                              ? "bg-warning"
                              : g.status === "COMPLETED"
                                ? "bg-success"
                                : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        น้ำหนัก {g.weight}
                        {g.dueDate ? ` · ครบกำหนด ${formatDate(g.dueDate)}` : ""}
                      </span>
                      <div className="flex items-center gap-1">
                        {isOwner && g.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setProgressGoal(g)}
                          >
                            <TrendingUp className="size-3.5" />
                            อัปเดต
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openEdit(g)}
                            aria-label="แก้ไข"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => setDeleteTarget(g)}
                            aria-label="ลบ"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />
      <ProgressDialog
        open={!!progressGoal}
        onOpenChange={(o) => !o && setProgressGoal(null)}
        goal={progressGoal}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="ลบเป้าหมาย?"
        description={deleteTarget?.title}
        confirmLabel="ลบ"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
