"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Lock,
  PencilLine,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rubricFor } from "@/features/appraisal-form/rating-labels";
import { ApiError } from "@/lib/api/client";
import { arrowSelect } from "@/lib/arrow-select";
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
  if (score === 1) return "bg-status-absent-bg text-status-absent-fg";
  if (score === max) return "bg-accent text-accent-foreground";
  return "bg-muted text-foreground";
}

/** The score as a plain number in a square (Favpo shows numbers, not pictures); the picked one is filled blue. */
function ScoreIcon({ score, small, picked }: { score: number; max: number; small?: boolean; picked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm border font-bold tabular-nums",
        small ? "size-9 text-base" : "size-12 text-xl",
        picked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
      )}
    >
      {score}
    </span>
  );
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

  // The first rated question's own words for each score (the form builder's "what each score means"), shown on the intro.
  const startDesc = useMemo(
    () => new Map((questions.find((x) => x.answerType === "RATING")?.levelDescriptions ?? []).map((l) => [l.score, l.text])),
    [questions],
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

  // Leaving this screen inside the app (back button, another menu) within the 1.2 s wait would drop the last answer:
  // save it on the way out.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!locked && dirty.current) void saveNow();
    };
  });
  useEffect(() => {
    const flush = flushRef;
    return () => flush.current();
  }, []);

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
      dirty.current = false;
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
    <div ref={topRef} className="relative isolate mx-auto max-w-2xl scroll-mt-4 space-y-4 pb-28 md:pb-4">
      {/* Header: who, as whom, progress per question, save state (a flat card). */}
      <section className="gv-frost rounded-lg p-3.5 sm:p-5" aria-label="งานประเมิน">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base leading-snug font-bold text-balance break-words">
              ประเมิน {task.personName}
            </h1>
            <p className="text-muted-foreground text-xs break-words">
              {task.roundName} · ในฐานะ{RATER_LABEL[task.raterType]}
              {task.endIso ? ` · ปิด ${fmtDay(task.endIso)}` : ""}
            </p>
          </div>
          {!locked && saveFailed && !save.isPending ? (
            <button
              type="button"
              onClick={saveNow}
              className="relative flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-destructive-muted px-2.5 text-xs font-bold text-destructive before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
            >
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
              ยังไม่บันทึก · ลองใหม่
            </button>
          ) : (
            !locked && (
              <span
                className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs tabular-nums"
                aria-live="polite"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    save.isPending ? "bg-status-late-dot" : "bg-status-normal-dot",
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
              className="h-[6px] flex-1 rounded-full transition-colors"
              style={{
                background:
                  view === "q" && i === cur
                    ? "var(--ring)"
                    : isAnswered(values[x.id])
                      ? "var(--primary)"
                      : "color-mix(in srgb, var(--primary) 16%, transparent)",
              }}
            />
          ))}
        </div>
      </section>

      {onBehalfOf && !locked && (
        <p className="bg-muted rounded-lg px-4 py-3 text-sm">
          คุณกำลังกรอกแทน <b>{onBehalfOf}</b> ระบบจะบันทึกว่า HR เป็นผู้ส่ง
        </p>
      )}
      {locked && (
        <p className="border-border bg-muted flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {task.status === "SUBMITTED"
            ? "ส่งผลประเมินแล้ว แก้ไขไม่ได้"
            : "รอบนี้ปิดแล้ว ส่งผลเพิ่มไม่ได้"}
        </p>
      )}

      {view === "start" && (
        <div className="gv-rise space-y-4">
          <div className="border-border bg-card flex items-center gap-3.5 rounded-lg border p-4 ">
            <PersonAvatar
              name={task.personName}
              gender={task.personGender}
              src={task.personAvatarUrl}
              seed={task.personCode}
              className="size-14 "
            />
            <div className="min-w-0">
              <p className="text-base leading-snug font-bold break-words">{task.personName}</p>
              {task.personRole && (
                <p className="text-muted-foreground text-sm">{task.personRole}</p>
              )}
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-accent px-2.5 text-xs font-bold text-primary">
                  {questions.length} หัวข้อ
                </span>
                <span className="rounded-full bg-accent px-2.5 text-xs font-bold text-primary">
                  ราว {Math.max(2, Math.ceil(questions.length * 0.6))} นาที
                </span>
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-foreground mb-2 px-0.5 text-sm font-bold text-balance">
              คะแนนแต่ละระดับหมายถึง
            </h2>
            <ul className="border-border bg-card overflow-hidden rounded-lg border">
              {rubric.map((r) => {
                const words = startDesc.get(r.score) ?? r.desc;
                return (
                  <li
                    key={r.score}
                    className="border-border flex items-start gap-3 border-t px-4 py-2.5 first:border-t-0"
                  >
                    <ScoreIcon score={r.score} max={task.ratingMax} small />
                    <span className="min-w-0 text-sm">
                      <b className="block text-sm">{r.label}</b>
                      {words && <span className="text-muted-foreground">{words}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              "ให้คะแนนจากสิ่งที่เห็นในรอบนี้ ไม่ใช่ความรู้สึกโดยรวม",
              ...(task.noteAtLowest
                ? [`ให้ “${rubric[rubric.length - 1]?.label}” ต้องเขียนตัวอย่างเหตุการณ์สั้นๆ`]
                : []),
              "บันทึกอัตโนมัติ ปิดแล้วกลับมาทำต่อได้",
            ].map((t, i) => (
              <li
                key={t}
                className="border-border bg-card flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
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
            <h2 className="text-xl font-bold text-balance">{locked ? "คำตอบที่ส่งแล้ว" : "ตรวจทวนก่อนส่ง"}</h2>
            {!locked && <p className="text-muted-foreground text-sm">กดหัวข้อเพื่อแก้</p>}
          </div>
          <ul className="border-border bg-card overflow-hidden rounded-lg border">
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
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
                        !done
                          ? x.required
                            ? "border border-dashed border-status-late-border bg-status-late-bg text-status-late-fg"
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
                      <b className="block text-sm leading-snug break-words">{x.text}</b>
                      <span
                        className={cn(
                          "block text-xs break-words",
                          (done && !noNote) || (!done && !x.required)
                            ? "text-muted-foreground"
                            : "text-status-late-fg",
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
                      <PencilLine className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {!locked && missing.length > 0 && (
            <p className="rounded-lg border border-status-late-border bg-status-late-bg px-3.5 py-2.5 text-sm text-status-late-fg">
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
      <div className="gv-foot gv-frost fixed inset-x-0 bottom-[calc(var(--gv-tabbar)+env(safe-area-inset-bottom))] z-30 rounded-t-lg border-x-0 border-b-0 px-4 py-3 md:sticky md:inset-x-auto md:bottom-4 md:rounded-lg md:border md:px-3">
        <div className="flex items-center gap-2">
          {view === "start" && (
            <Button
              className="h-12 flex-1 font-bold"
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
                {qBlocked
                  ? q && q.required && !isAnswered(values[q.id])
                    ? q.answerType === "RATING"
                      ? "เลือกคะแนนก่อน"
                      : q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE"
                        ? "เลือกคำตอบก่อน"
                        : "ตอบข้อนี้ก่อน"
                    : "เขียนตัวอย่างก่อน"
                  : cur === questions.length - 1
                    ? "ตรวจทวน"
                    : "ข้อถัดไป"}{" "}
                {!qBlocked && <ArrowRight className="size-4" aria-hidden="true" />}
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
                className="h-12 flex-1 font-bold"
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
  const [helpOpen, setHelpOpen] = useState(false);
  const picked = q.answerType === "RATING" && value !== undefined;
  return (
    <div className="gv-rise space-y-3.5">
      <div>
        <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
          ข้อ {index + 1} จาก {total}
          {q.section ? ` · ${q.section}` : ""}
          {!q.required && " · ไม่บังคับ"}
        </span>
        <h2 className="mt-2 text-xl leading-snug font-bold break-words text-balance">{q.text}</h2>
      </div>
      {q.helpText && (
        <div className="gv-frost flex items-start gap-2.5 rounded-lg px-3 py-2.5">
          <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
            <Info className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-muted-foreground text-sm leading-relaxed whitespace-pre-line",
                !helpOpen && "line-clamp-2",
              )}
            >
              <b className="text-foreground font-semibold">ดูจาก:</b> {q.helpText}
            </p>
            {(q.helpText.length > 70 || q.helpText.split(/\r?\n/).length > 2) && (
              <button
                type="button"
                aria-expanded={helpOpen}
                onClick={() => setHelpOpen((o) => !o)}
                className="text-primary relative min-h-8 text-sm font-bold before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-['']"
              >
                {helpOpen ? "ย่อ" : "ดูทั้งหมด"}
              </button>
            )}
          </div>
        </div>
      )}

      {q.answerType === "RATING" && (
        <div
          role="radiogroup"
          aria-label={q.text}
          onKeyDown={arrowSelect}
          className={cn("grid", ratingMax > 3 ? "gap-2" : "gap-2.5")}
        >
          {rubric.map((r, ri) => {
            const on = value === r.score;
            const desc = own.get(r.score) ?? r.desc;
            const low = r.score === 1;
            return (
              <button
                key={r.score}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on || (value === undefined && ri === 0) ? 0 : -1}
                disabled={disabled}
                onClick={() => onValue(r.score)}
                className={cn(
                  "bg-card/90 relative flex w-full items-start gap-3 rounded-lg border-[1.5px] py-3 pr-3.5 pl-3 text-left transition-[border-color,box-shadow,transform,opacity] duration-200 active:scale-[0.985] disabled:opacity-60 dark:shadow-none",
                  on
                    ? low
                      ? "border-destructive border-2 "
                      : "border-primary border-2 "
                    : "border-border hover:border-ring/50",
                  picked && !on && "opacity-85",
                )}
              >
                <ScoreIcon score={r.score} max={ratingMax} small={ratingMax > 3} picked={on} />
                <span className="min-w-0 flex-1">
                  <b className="flex items-center gap-2 text-base leading-snug">
                    {r.label}
                    {on && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 text-xs leading-relaxed font-bold",
                          low
                            ? "bg-status-absent-bg text-status-absent-fg"
                            : "bg-accent text-accent-foreground",
                        )}
                      >
                        <Check className="size-3" aria-hidden="true" />
                        เลือกแล้ว
                      </span>
                    )}
                  </b>
                  {desc && (
                    <span
                      className={cn(
                        "text-muted-foreground mt-0.5 block text-sm leading-relaxed",
                        picked && !on && "line-clamp-2",
                      )}
                    >
                      {desc}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    on
                      ? low
                        ? "border-destructive bg-destructive text-destructive-foreground"
                        : "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/50 bg-card/50",
                  )}
                >
                  {on && <Check className="size-4" strokeWidth={3.4} />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {q.answerType === "RATING" && (
        <label
          className={cn(
            "gv-frost block rounded-lg px-3.5 py-2.5 transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            noteMissing && "border-status-absent-border bg-status-absent-bg/60",
          )}
        >
          <span className="text-foreground flex justify-between gap-2 text-sm font-bold">
            ตัวอย่างเหตุการณ์
            <span
              className={cn(
                "font-semibold",
                noteRequired ? "text-status-absent-fg" : "text-muted-foreground",
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

      {noteMissing && (
        <p className="text-status-absent-fg flex items-start gap-2 text-sm font-bold">
          <TriangleAlert className="mt-1 size-[18px] shrink-0" aria-hidden="true" />
          เขียนตัวอย่างสั้นๆ ก่อน จึงกดข้อถัดไปได้
        </p>
      )}

      {(q.answerType === "CHOICE" || q.answerType === "MULTI_CHOICE") && (
        <div
          role={q.answerType === "CHOICE" ? "radiogroup" : "group"}
          aria-label={q.text}
          onKeyDown={q.answerType === "CHOICE" ? arrowSelect : undefined}
          className="grid gap-2"
        >
          {(q.options ?? []).map((o, oi) => {
            const picked = Array.isArray(value) ? value.includes(o.value) : value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role={q.answerType === "CHOICE" ? "radio" : "checkbox"}
                aria-checked={picked}
                tabIndex={q.answerType === "CHOICE" && !picked && (value !== undefined || oi > 0) ? -1 : 0}
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
                  "bg-card flex min-h-12 w-full items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-2 text-left text-sm transition-colors disabled:opacity-60",
                  picked ? "bg-accent border-primary" : "border-border",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center border",
                    q.answerType === "CHOICE" ? "rounded-full" : "rounded-[5px]",
                    picked
                      ? "border-primary bg-primary text-primary-foreground"
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
          autoComplete="off"
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
