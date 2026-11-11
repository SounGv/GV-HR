"use client";

import Link from "next/link";
import { ClipboardList, UserRoundX } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import { useHrAssignment, useSaveHrAssignment, useSaveTask, useTask, useTasks } from "./hooks";
import { ASSIGNMENT_STATUS_LABEL, RATER_LABEL, type AssignmentStatus, type HrAssignmentDetail, type TaskDetail } from "./types";
import { TaskForm } from "./task-form";

const TONE: Record<AssignmentStatus, StatusTone> = { PENDING: "warning", IN_PROGRESS: "info", SUBMITTED: "success" };
const fmtDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";

/** "งานประเมินของฉัน": who the signed-in person has to rate. This is where the invitation link lands. */
export function TaskListView() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useTasks(!!user.employee);
  // Evaluation jobs belong to employees; an admin-only login has none (the API answers 400), so say so plainly.
  if (!user.employee) {
    return (
      <EmptyState
        icon={UserRoundX}
        title="บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน"
        description="งานประเมินเป็นของพนักงานแต่ละคน บัญชีนี้จึงไม่มีคนที่ต้องประเมิน ดูความคืบหน้าทุกรอบได้ที่ ภาพรวมการประเมิน"
      />
    );
  }
  const tasks = data?.data ?? [];
  const todo = tasks.filter((t) => t.status !== "SUBMITTED" && t.roundStatus === "OPEN");
  const rest = tasks.filter((t) => !todo.includes(t));

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading) return <TableLoadingState rows={4} />;
  if (tasks.length === 0) {
    return <EmptyState icon={ClipboardList} title="ยังไม่มีงานประเมิน" description="เมื่อมีรอบประเมินที่คุณต้องประเมิน จะแสดงที่นี่และแจ้งในกล่องข้อความ" />;
  }

  const row = (t: (typeof tasks)[number]) => (
    <Link key={t.id} href={`/appraisal/tasks/${t.id}`} className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50">
      <span className="min-w-0">
        <span className="block text-sm font-semibold break-words text-foreground">{t.personName}</span>
        <span className="block text-sm text-muted-foreground">
          {t.roundName} · ประเมินในฐานะ{RATER_LABEL[t.raterType]}
          {t.endIso ? ` · ปิด ${fmtDay(t.endIso)}` : ""}
        </span>
      </span>
      <StatusChip tone={t.roundStatus === "CLOSED" && t.status !== "SUBMITTED" ? "neutral" : TONE[t.status]} label={t.roundStatus === "CLOSED" && t.status !== "SUBMITTED" ? "ปิดรอบแล้ว" : ASSIGNMENT_STATUS_LABEL[t.status]} />
    </Link>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="ที่ต้องประเมิน">
        <h2 className="text-sm font-semibold">ที่ต้องประเมิน ({todo.length})</h2>
        {todo.length === 0 ? <p className="text-sm text-muted-foreground">ไม่มีงานค้าง</p> : <Card className="gap-0 divide-y divide-border p-0">{todo.map(row)}</Card>}
      </section>
      {rest.length > 0 && (
        <section className="space-y-2" aria-label="ส่งแล้วหรือปิดรอบแล้ว">
          <h2 className="text-sm font-semibold">ส่งแล้ว / ปิดรอบแล้ว ({rest.length})</h2>
          <Card className="gap-0 divide-y divide-border p-0">{rest.map(row)}</Card>
        </section>
      )}
    </div>
  );
}

/** Loads one job and hands it to the answering screen. */
export function TaskPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useTask(id);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  return <RaterTaskForm key={data.data.id} task={data.data} />;
}

function RaterTaskForm({ task }: { task: TaskDetail }) {
  const save = useSaveTask(task.id);
  return <TaskForm task={task} save={save} backHref="/appraisal/tasks" backLabel="งานประเมินของฉัน" />;
}

/** HR fills in a rater's job for them (e.g. someone who cannot sign in). The audit log records who did it. */
export function HrFillPage({ roundId, assignmentId }: { roundId: string; assignmentId: string }) {
  const { data, isLoading, isError, refetch } = useHrAssignment(roundId, assignmentId);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  return <HrFillForm key={data.data.id} roundId={roundId} task={data.data} />;
}

function HrFillForm({ roundId, task }: { roundId: string; task: HrAssignmentDetail }) {
  const save = useSaveHrAssignment(roundId, task.id);
  return <TaskForm task={task} save={save} backHref={`/appraisal/rounds/${roundId}`} backLabel="รอบประเมิน" onBehalfOf={task.raterName} />;
}
