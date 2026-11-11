"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, Lock, PencilLine, Send } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rubricFor } from "@/features/appraisal-form/rating-labels";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  NOTE_MAX,
  needsNote,
  unansweredRequired,
  type AnswerValue,
  type SnapQuestion,
} from "./answers";
import { RATER_LABEL, type TaskDetail } from "./types";

/*
 * The rater's answering screen (rater-screen-mock.html): a short intro, one
 * question per screen with every score spelled out, an example box (required
 * for the lowest score when the form says so), then a review before sending.
 * Saved automatically a moment after every change.
 */

const LIME = "#CDEB03";
const fmtDay = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", timeZone: "UTC" }).format(
        new Date(`${iso}T00:00:00Z`),
      )
    : "";
const timeNow = () =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date());

type Values = Record<string, AnswerValue>;
type Save = {
  mutateAsync: (input: {
    answers: { questionId: string; value: unknown; note?: string }[];
    submit: boolean;
  }) => Promise<unknown>;
  isPending: boolean;
};

/** Score chip colour: the lowest score warns, the highest is teal, the rest neutral (also used by the form builder). */
export function scoreTone(score: number, max: number) {
  if (score === 1) return "bg-[#fff7ed] text-[#c2410c] dark:bg-orange-500/15 dark:text-orange-300";
  if (score === max) return "bg-[#ccfbf1] text-[#0f766e] dark:bg-teal-500/15 dark:text-teal-300";
  return "bg-muted text-foreground";
}

const isAnswered = (v: AnswerValue | undefined) =>
  v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

export function TaskForm({
  task,
  save,
  backHref,
  backLabel,
  onBehalfOf,
}: {
  task: TaskDetail;
  save: Save;
  backHref: string;
  backLabel: string;
  /** Set when HR is filling in for this rater. */
  onBehalfOf?: string;
}) {
  const router = useRouter();
  const locked = task.status === "SUBMITTED" || task.roundStatus !== "OPEN";
  const questions = task.questions as SnapQuestion[];
  const rubric = useMemo(
    () => rubricFor(task.ratingMax, task.ratingLabels),
    [task.ratingMax, task.ratingLabels],
  );

  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(task.answers.map((a) => [a.questionId, a.value])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      task.answers.filter((a) => a.note).map((a) => [a.questionId, a.note as string]),
    ),
  );
  // Someone who already started goes straight to their first open question.
  const firstOpen = questions.findIndex((q) => !isAnswered(values[q.id]));
  const [view, setView] = useState<"start" | "q" | "review">(
    locked ? "review" : task.answers.length ? "q" : "start",
  );
  const [cur, setCur] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // A failed auto-save stays visible (with a retry) until a save goes through.
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const dirty = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const list = Object.entries(values)
    .filter(([, v]) => isAnswered(v))
    .map(([questionId, value]) =>
      notes[questionId]?.trim()
        ? { questionId, value, note: notes[questionId] }
        : { questionId, value },
    );
  const missing = unansweredRequired(questions, task.raterType, list as never, {
    noteAtLowest: task.noteAtLowest,
  });
  const answeredCount = questions.filter((q) => isAnswered(values[q.id])).length;

  function setValue(qid: string, v: AnswerValue) {
    dirty.current = true;
    setValues((c) => ({ ...c, [qid]: v }));
  }
  function setNote(qid: string, t: string) {
    dirty.current = true;
    setNotes((c) => ({ ...c, [qid]: t }));
  }

  async function saveNow() {
    try {
      await save.mutateAsync({ answers: list, submit: false });
      dirty.current = false;
      setSaveFailed(false);
      setSavedAt(timeNow());
    } catch (err) {
      setSaveFailed(true);
      toast.error(
        err instanceof ApiError
          ? err.message
          : "บันทึกอัตโนมัติไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วกด “ลองใหม่” ด้านบน",
        {
          id: "appraisal-autosave",
        },
      );
    }
  }

  // Auto-save a moment after the last change.
  useEffect(() => {
    if (locked || !dirty.current) return;
    const t = setTimeout(saveNow, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, notes]);

  // Closing the page with answers not yet saved asks first.
  useEffect(() => {
    if (locked) return;
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [locked]);

  function go(next: "start" | "q" | "review", index = cur) {
    setView(next);
    setCur(index);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function onSubmit() {
    try {
      await save.mutateAsync({ answers: list, submit: true });
      toast.success(`ส่งผลประเมิน ${task.personName} แล้ว`);
      router.push(backHref);
    } catch (err) {
      setConfirm(false);
      toast.error(err instanceof ApiError ? err.message : "ส่งไม่สำเร็จ");
    }
  }

  const q = questions[cur];
  const qBlocked =
    view === "q" &&
    q &&
    ((q.required && !isAnswered(values[q.id])) ||
      needsNote(q, list.find((a) => a.questionId === q.id) as never, task.noteAtLowest));

  return (
    <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-4 space-y-4 pb-28">
      {/* Header: who, as whom, progress per question, save state. */}
      <section className="gv-hero p-4 sm:p-5" aria-label="งานประเมิน">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            aria-label={`กลับไป${backLabel}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 hover:bg-white/20"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15.5px] leading-snug font-bold">
              ประเมิน {task.personName}
            </h1>
            <p className="truncate text-xs text-white/75">
              {task.roundName} · ในฐานะ{RATER_LABEL[task.raterType]}
              {task.endIso ? ` · ปิด ${fmtDay(task.endIso)}` : ""}
            </p>
          </div>
          {!locked && saveFailed && !save.isPending ? (
            <button
              type="button"
              onClick={saveNow}
              className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#fef2f2] px-2.5 text-[11.5px] font-bold text-[#b91c1c]"
            >
              <span className="size-1.5 rounded-full bg-[#dc2626]" aria-hidden="true" />
              ยังไม่บันทึก · ลองใหม่
            </button>
          ) : (
            !locked && (
              <span
                className="flex shrink-0 items-center gap-1.5 text-[11px] text-white/80"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    save.isPending ? "bg-[#fde047]" : "bg-[#4ade80]",
                  )}
                  aria-hidden="true"
                />
                {save.isPending
                  ? "กำลังบันทึก"
                  : savedAt
                    ? `บันทึกแล้ว ${savedAt}`
                    : "บันทึกอัตโนมัติ"}
              </span>
            )
          )}
        </div>
        <div
          className="mt-3 flex gap-1"
          aria-label={`ตอบแล้ว ${answeredCount} จาก ${questions.length} ข้อ`}
          role="img"
        >
          {questions.map((x, i) => (
            <span
              key={x.id}
              className="h-[5px] flex-1 rounded-full transition-colors"
              style={{
                background:
                  view === "q" && i === cur
                    ? "#fff"
                    : isAnswered(values[x.id])
                      ? LIME
                      : "rgba(255,255,255,.2)",
              }}
            />
          ))}
        </div>
      </section>

      {onBehalfOf && !locked && (
        <p className="bg-muted rounded-xl px-4 py-3 text-sm">
          คุณกำลังกรอกแทน <b>{onBehalfOf}</b> ระบบจะบันทึกว่า HR เป็นผู้ส่ง
        </p>
      )}
      {locked && (
        <p className="border-border bg-muted flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {task.status === "SUBMITTED"
            ? "ส่งผลประเมินแล้ว แก้ไขไม่ได้"
            : "รอบนี้ปิดแล้ว ส่งผลเพิ่มไม่ได้"}
        </p>
      )}

      {view === "start" && (
        <div className="gv-rise space-y-4">
          <div className="border-border bg-card flex items-center gap-3.5 rounded-[22px] border p-4 shadow-[var(--card-shadow)]">
            <PersonAvatar
              name={task.personName}
              gender={task.personGender}
              seed={task.personCode}
              className="size-14 shadow-[0_0_0_3px_var(--card)]"
            />
            <div className="min-w-0">
              <p className="text-[17px] leading-snug font-bold break-words">{task.personName}</p>
              {task.personRole && (
                <p className="text-muted-foreground text-[13px]">{task.personRole}</p>
              )}
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[#ccfbf1] px-2.5 text-[11.5px] font-bold text-[#0f766e]">
                  {questions.length} หัวข้อ
                </span>
                <span className="rounded-full bg-[#ccfbf1] px-2.5 text-[11.5px] font-bold text-[#0f766e]">
                  ราว {Math.max(2, Math.ceil(questions.length * 0.6))} นาที
                </span>
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-foreground/80 mb-2 px-0.5 text-[13px] font-bold">
              คะแนนแต่ละระดับหมายถึง
            </h2>
            <ul className="border-border bg-card overflow-hidden rounded-[18px] border">
              {rubric.map((r) => (
                <li
                  key={r.score}
                  className="border-border flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold",
                      scoreTone(r.score, task.ratingMax),
                    )}
                  >
                    {r.score}
                  </span>
                  <span className="min-w-0 text-[13px]">
                    <b className="block text-[13.5px]">{r.label}</b>
                    {r.desc && <span className="text-muted-foreground">{r.desc}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-2 text-[13px]">
            {[
              "ให้คะแนนจากสิ่งที่เห็นในรอบนี้ ไม่ใช่ความรู้สึกโดยรวม",
              ...(task.noteAtLowest
                ? [`ให้ “${rubric[rubric.length - 1]?.label}” ต้องเขียนตัวอย่างเหตุการณ์สั้นๆ`]
                : []),
              "บันทึกอัตโนมัติ ปิดแล้วกลับมาทำต่อได้",
            ].map((t, i) => (
              <li
                key={t}
                className="border-border bg-card flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5"
              >
                <span className="bg-accent text-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "q" && q && (
        <QuestionStep
          key={q.id}
          q={q}
          index={cur}
          total={questions.length}
          rubric={rubric}
          ratingMax={task.ratingMax}
          value={values[q.id]}
          note={notes[q.id] ?? ""}
          noteRequired={task.noteAtLowest && q.answerType === "RATING" && values[q.id] === 1}
          disabled={locked}
          onValue={(v) => setValue(q.id, v)}
          onNote={(t) => setNote(q.id, t)}
        />
      )}

      {view === "review" && (
        <div className="gv-rise space-y-3">
          <div>
            <h2 className="text-xl font-bold">{locked ? "คำตอบที่ส่งแล้ว" : "ตรวจทวนก่อนส่ง"}</h2>
            {!locked && <p className="text-muted-foreground text-[13px]">กดหัวข้อเพื่อแก้</p>}
          </div>
          <ul className="border-border bg-card overflow-hidden rounded-[18px] border">
            {questions.map((x, i) => {
              const v = values[x.id];
              const done = isAnswered(v);
              const line = rubric.find((r) => r.score === v);
              const shown =
                x.answerType === "RATING"
                  ? line?.label
                  : Array.isArray(v)
                    ? (x.options ?? [])
                        .filter((o) => v.includes(o.value))
                        .map((o) => o.label)
                        .join(", ")
                    : x.answerType === "CHOICE"
                      ? (x.options ?? []).find((o) => o.value === v)?.label
                      : typeof v === "string"
                        ? v
                        : "";
              const noNote = needsNote(
                x,
                list.find((a) => a.questionId === x.id) as never,
                task.noteAtLowest,
              );
              return (
                <li key={x.id} className="border-border border-t first:border-t-0">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => go("q", i)}
                    className="hover:bg-muted/60 flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-sm font-bold",
                        !done
                          ? x.required
                            ? "border border-dashed border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
                            : "border-border text-muted-foreground border border-dashed"
                          : x.answerType === "RATING"
                            ? scoreTone(v as number, task.ratingMax)
                            : "bg-muted text-foreground",
                      )}
                    >
                      {!done ? (
                        "?"
                      ) : x.answerType === "RATING" ? (
                        (v as number)
                      ) : (
                        <Check className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13.5px] leading-snug break-words">{x.text}</b>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          (done && !noNote) || (!done && !x.required)
                            ? "text-muted-foreground"
                            : "text-[#b45309]",
                        )}
                      >
                        {!done
                          ? x.required
                            ? "ยังไม่ได้ตอบ"
                            : "ไม่ได้ตอบ (ไม่บังคับ)"
                          : noNote
                            ? `${shown} · ยังไม่มีตัวอย่าง`
                            : `${shown}${notes[x.id]?.trim() ? " · มีตัวอย่าง" : ""}`}
                      </span>
                    </span>
                    {!locked && (
                      <PencilLine className="size-4 shrink-0 text-[#0f766e]" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {!locked && missing.length > 0 && (
            <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 text-[13px] text-[#92400e] dark:bg-amber-500/10 dark:text-amber-200">
              ยังส่งไม่ได้ · {missing.join(", ")}
            </p>
          )}
          {!locked && (
            <p className="text-muted-foreground text-xs">
              ส่งแล้วแก้ไม่ได้ · ผู้ถูกประเมินเห็นผลหลัง HR ประกาศ
            </p>
          )}
        </div>
      )}

      {/* Thumb bar: one main action per screen. */}
      <div className="border-border bg-background fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t px-4 py-3 md:bottom-0 md:left-[var(--sidebar-width,0px)] md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {view === "start" && (
            <Button
              className="h-12 flex-1 font-bold text-[#131516] hover:brightness-95"
              style={{ background: LIME }}
              onClick={() => go("q", firstOpen === -1 ? 0 : firstOpen)}
            >
              เริ่มประเมิน <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
          {view === "q" && (
            <>
              <Button
                variant="outline"
                className="h-12 px-4"
                aria-label="ข้อก่อนหน้า"
                onClick={() => (cur === 0 ? go("start", 0) : go("q", cur - 1))}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                className="h-12 flex-1 font-bold"
                disabled={!!qBlocked}
                onClick={() => (cur === questions.length - 1 ? go("review") : go("q", cur + 1))}
              >
                {cur === questions.length - 1 ? "ตรวจทวน" : "ข้อถัดไป"}{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
          {view === "review" && !locked && (
            <>
              <Button
                variant="outline"
                className="h-12 px-4"
                aria-label="กลับไปข้อสุดท้าย"
                onClick={() => go("q", questions.length - 1)}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                className="h-12 flex-1 font-bold text-[#131516] hover:brightness-95"
                style={{ background: LIME }}
                disabled={save.isPending || missing.length > 0}
                onClick={() => setConfirm(true)}
              >
                <Send className="size-4" aria-hidden="true" /> ส่งผลประเมิน
              </Button>
            </>
          )}
          {view === "review" && locked && (
            <Button variant="outline" className="h-12 flex-1" onClick={() => router.push(backHref)}>
              กลับไป{backLabel}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`ส่งผลประเมิน ${task.personName}?`}
        description="ส่งแล้วแก้ไขไม่ได้"
        confirmLabel="ส่งผลประเมิน"
        onConfirm={onSubmit}
        loading={save.isPending}
      />
    </div>
  );
}

/** One question: the full-width score rows (number, name and what it looks like together), or the choice / text input. */
export function QuestionStep({
  q,
  index,
  total,
  rubric,
  ratingMax,
  value,
  note,
  noteRequired,
  disabled,
  onValue,
  onNote,
}: {
  q: SnapQuestion;
  index: number;
  total: number;
  rubric: { score: number; label: string; desc: string | null }[];
  ratingMax: number;
  value: AnswerValue | undefined;
  note: string;
  noteRequired: boolean;
  disabled: boolean;
  onValue: (v: AnswerValue) => void;
  onNote: (t: string) => void;
}) {
  const own = new Map((q.levelDescriptions ?? []).map((l) => [l.score, l.text]));
  const noteMissing = noteRequired && !note.trim();
  return (
    <div className="gv-rise space-y-3.5">
      <div>
        <span className="dark:bg-accent dark:text-primary inline-flex rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-[11.5px] font-bold text-[#0f766e] tabular-nums">
          ข้อ {index + 1} จาก {total}
          {q.section ? ` · ${q.section}` : ""}
          {!q.required && " · ไม่บังคับ"}
        </span>
        <h2 className="mt-2 text-xl leading-snug font-bold break-words">{q.text}</h2>
        {q.helpText && (
          <p className="text-muted-foreground mt-1 text-[13px]">
            <b className="text-foreground/80 font-semibold">ดูจาก:</b> {q.helpText}
          </p>
        )}
      </div>

      {q.answerType === "RATING" && (
        <div role="radiogroup" aria-label={q.text} className="grid gap-2.5">
          {rubric.map((r) => {
            const on = value === r.score;
            const desc = own.get(r.score) ?? r.desc;
            return (
              <button
                key={r.score}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onValue(r.score)}
                className={cn(
                  "bg-card flex w-full items-start gap-3 rounded-[18px] border-[1.5px] px-3.5 py-3 text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.985] disabled:opacity-60",
                  on
                    ? r.score === 1
                      ? "border-[#ea580c] shadow-[0_0_0_3px_#ffedd5] dark:shadow-none"
                      : "border-[#0f766e] shadow-[0_0_0_3px_#ccfbf1] dark:shadow-none"
                    : "border-border hover:border-[#0d9488]/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[13px] text-[17px] font-bold",
                    scoreTone(r.score, ratingMax),
                  )}
                >
                  {r.score}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] leading-snug">{r.label}</b>
                  {desc && (
                    <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-relaxed">
                      {desc}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-[22px] shrink-0 rounded-full border-2 transition-[border-width]",
                    on
                      ? r.score === 1
                        ? "border-[7px] border-[#ea580c]"
                        : "border-[7px] border-[#0f766e]"
                      : "border-[#c4ccd2]",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}

      {q.answerType === "RATING" && (
        <label
          className={cn(
            "bg-card block rounded-2xl border px-3.5 py-2.5",
            noteMissing ? "border-[#fdba74] bg-[#fffaf5] dark:bg-orange-500/10" : "border-border",
          )}
        >
          <span className="text-foreground/80 flex justify-between gap-2 text-[12.5px] font-bold">
            ตัวอย่างเหตุการณ์
            <span
              className={cn(
                "font-semibold",
                noteRequired ? "text-[#c2410c]" : "text-muted-foreground",
              )}
            >
              {noteRequired ? "จำเป็นเมื่อให้คะแนนนี้" : "ไม่บังคับ"}
            </span>
          </span>
          <Textarea
            rows={2}
            maxLength={NOTE_MAX}
            disabled={disabled}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder="เช่น สัปดาห์ที่ 2 ส่งของผิดสาขา 3 ครั้ง"
            className="mt-1 min-h-[56px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </label>
      )}

      {(q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE") && (
        <div
          role={q.answerType === "CHOICE" ? "radiogroup" : "group"}
          aria-label={q.text}
          className="grid gap-2"
        >
          {(q.options ?? []).map((o) => {
            const picked = Array.isArray(value) ? value.includes(o.value) : value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role={q.answerType === "CHOICE" ? "radio" : "checkbox"}
                aria-checked={picked}
                disabled={disabled}
                onClick={() =>
                  q.answerType === "CHOICE"
                    ? onValue(o.value)
                    : onValue(
                        picked
                          ? Array.isArray(value)
                            ? value.filter((x) => x !== o.value)
                            : []
                          : [...(Array.isArray(value) ? value : []), o.value],
                      )
                }
                className={cn(
                  "bg-card flex min-h-12 w-full items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-2 text-left text-sm transition-colors disabled:opacity-60",
                  picked ? "bg-accent border-[#0f766e]" : "border-border",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center border",
                    q.answerType === "CHOICE" ? "rounded-full" : "rounded-[5px]",
                    picked
                      ? "border-[#0f766e] bg-[#0f766e] text-white"
                      : "border-[color:var(--field-border)]",
                  )}
                >
                  {picked && <Check className="size-3.5" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {q.answerType === "SHORT_TEXT" && (
        <Input
          aria-label={q.text}
          className="h-12"
          maxLength={500}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
      {q.answerType === "PARAGRAPH" && (
        <Textarea
          aria-label={q.text}
          rows={6}
          maxLength={4000}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
    </div>
  );
}
