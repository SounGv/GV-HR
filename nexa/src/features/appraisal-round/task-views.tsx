"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardList, Lock } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip, type StatusTone } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SCORE_RUBRIC } from "@/features/performance/calc";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useSaveTask, useTask, useTasks } from "./hooks";
import { unansweredRequired, type AnswerValue } from "./answers";
import { ASSIGNMENT_STATUS_LABEL, RATER_LABEL, type AssignmentStatus, type TaskDetail } from "./types";

const TONE: Record<AssignmentStatus, StatusTone> = { PENDING: "warning", IN_PROGRESS: "info", SUBMITTED: "success" };
const fmtDay = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";

/** "งานประเมินของฉัน": who the signed-in person has to rate. This is where the invitation link lands. */
export function TaskListView() {
  const { data, isLoading, isError, refetch } = useTasks();
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
  return <TaskForm key={data.data.id} task={data.data} />;
}

type Values = Record<string, AnswerValue>;

function TaskForm({ task }: { task: TaskDetail }) {
  const router = useRouter();
  const locked = task.status === "SUBMITTED" || task.roundStatus !== "OPEN";
  const [values, setValues] = useState<Values>(() => Object.fromEntries(task.answers.map((a) => [a.questionId, a.value])));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const save = useSaveTask(task.id);
  const dirty = useRef(false);

  const list = Object.entries(values).map(([questionId, value]) => ({ questionId, value }));
  const answered = list.filter((a) => a.value !== "" && !(Array.isArray(a.value) && a.value.length === 0));
  const missing = unansweredRequired(task.questions, task.raterType, answered);
  const pct = task.questions.length ? Math.round((answered.length / task.questions.length) * 100) : 0;

  function set(qid: string, v: AnswerValue) {
    dirty.current = true;
    setValues((cur) => ({ ...cur, [qid]: v }));
  }

  // Auto-save the draft a moment after the last change.
  useEffect(() => {
    if (locked || !dirty.current) return;
    const t = setTimeout(async () => {
      try {
        await save.mutateAsync({ answers: list, submit: false });
        dirty.current = false;
        setSavedAt(new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date()));
      } catch {
        /* the visible "save" button reports errors; auto-save stays quiet */
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  async function onSubmit() {
    try {
      await save.mutateAsync({ answers: list, submit: true });
      toast.success("ส่งผลประเมินแล้ว");
      router.push("/appraisal/tasks");
    } catch (err) {
      setConfirm(false);
      toast.error(err instanceof ApiError ? err.message : "ส่งไม่สำเร็จ");
    }
  }

  async function onSaveDraft() {
    try {
      await save.mutateAsync({ answers: list, submit: false });
      dirty.current = false;
      toast.success("บันทึกร่างแล้ว");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const rubric = SCORE_RUBRIC.filter((r) => r.score <= task.ratingMax);

  return (
    <div className="space-y-4 pb-28">
      <PageHeaderBar
        breadcrumbs={[{ label: "งานประเมินของฉัน", href: "/appraisal/tasks" }, { label: task.personName }]}
        backHref="/appraisal/tasks"
        title={`ประเมิน ${task.personName}`}
        description={`${task.roundName} · ในฐานะ${RATER_LABEL[task.raterType]}${task.endIso ? ` · ปิด ${fmtDay(task.endIso)}` : ""}`}
        status={<StatusChip tone={TONE[task.status]} label={ASSIGNMENT_STATUS_LABEL[task.status]} />}
        sticky={false}
      />

      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {task.status === "SUBMITTED" ? "ส่งผลประเมินแล้ว แก้ไขไม่ได้" : "รอบนี้ปิดแล้ว ส่งผลเพิ่มไม่ได้"}
        </div>
      )}

      <div role="progressbar" aria-label="ตอบแล้ว" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[var(--flip7-teal-dark)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        ตอบแล้ว {answered.length} จาก {task.questions.length} ข้อ{savedAt ? ` · บันทึกร่างอัตโนมัติ ${savedAt} น.` : ""}
      </p>

      {task.questions.map((q, i) => {
        const v = values[q.id];
        return (
          <Card key={q.id} className="gap-3 p-4">
            <h2 className="text-base font-semibold">
              {i + 1}. {q.text}
              {q.required && <span className="text-destructive"> *</span>}
            </h2>
            {q.helpText && <p className="text-sm text-muted-foreground">{q.helpText}</p>}

            {q.answerType === "RATING" && (
              <div role="radiogroup" aria-label={q.text} className="space-y-2">
                {rubric.map((r) => {
                  const on = v === r.score;
                  return (
                    <button
                      key={r.score}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={locked}
                      onClick={() => set(q.id, r.score)}
                      className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left", on ? "border-primary bg-accent" : "border-border bg-card", "disabled:opacity-60")}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-accent-foreground">{r.score}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{r.label}</span>
                        <span className="block text-sm text-muted-foreground">{r.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {(q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE") && (
              <div role={q.answerType === "CHOICE" ? "radiogroup" : "group"} aria-label={q.text} className="space-y-2">
                {(q.options ?? []).map((o) => {
                  const picked = Array.isArray(v) ? v.includes(o.value) : v === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role={q.answerType === "CHOICE" ? "radio" : "checkbox"}
                      aria-checked={picked}
                      disabled={locked}
                      onClick={() =>
                        q.answerType === "CHOICE"
                          ? set(q.id, o.value)
                          : set(q.id, picked ? (Array.isArray(v) ? v.filter((x) => x !== o.value) : []) : [...(Array.isArray(v) ? v : []), o.value])
                      }
                      className={cn("flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm", picked ? "border-primary bg-accent" : "border-border bg-card", "disabled:opacity-60")}
                    >
                      <span className={cn("flex size-5 shrink-0 items-center justify-center border", q.answerType === "CHOICE" ? "rounded-full" : "rounded-[4px]", picked ? "border-primary bg-primary text-primary-foreground" : "border-input")} aria-hidden="true">
                        {picked && <CircleCheck className="size-3.5" />}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.answerType === "SHORT_TEXT" && (
              <Input aria-label={q.text} className="h-11" maxLength={500} disabled={locked} value={typeof v === "string" ? v : ""} onChange={(e) => set(q.id, e.target.value)} />
            )}
            {q.answerType === "PARAGRAPH" && (
              <Textarea aria-label={q.text} rows={5} maxLength={4000} disabled={locked} value={typeof v === "string" ? v : ""} onChange={(e) => set(q.id, e.target.value)} />
            )}
          </Card>
        );
      })}

      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:left-[var(--sidebar-width,0px)]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{missing.length > 0 ? `ยังไม่ได้ตอบ ${missing.join(", ")}` : "ตอบครบแล้ว"}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" onClick={onSaveDraft} disabled={save.isPending}>
                บันทึกร่าง
              </Button>
              <Button className="h-11" onClick={() => setConfirm(true)} disabled={save.isPending || missing.length > 0}>
                ส่งผลประเมิน
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="ส่งผลประเมิน?"
        description="ส่งแล้วแก้ไขไม่ได้"
        confirmLabel="ส่งผลประเมิน"
        onConfirm={onSubmit}
        loading={save.isPending}
      />
    </div>
  );
}
