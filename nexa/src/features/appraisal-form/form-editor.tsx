"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, TriangleAlert, CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeaderBar } from "@/components/shared/page-header-bar";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/auth-context";
import { SCORE_RUBRIC } from "@/features/performance/calc";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useAppraisalForm,
  useNewAppraisalFormVersion,
  usePublishAppraisalForm,
  useSaveAppraisalForm,
} from "./hooks";
import { formProblems, ratingWeightTotal } from "./rules";
import {
  ANSWER_TYPE_LABEL,
  RATER_LABEL,
  STATUS_LABEL,
  type AnswerType,
  type FormDetail,
  type QuestionValues,
  type RaterType,
} from "./types";

const RATERS = Object.keys(RATER_LABEL) as RaterType[];
const CHOICE = new Set<AnswerType>(["CHOICE", "MULTI_CHOICE"]);

const newKey = () => crypto.randomUUID();

function emptyQuestion(): QuestionValues {
  return { uiKey: newKey(), text: "", helpText: "", answerType: "RATING", options: [], weight: 1, required: true, visibleTo: [] };
}

function emptyOption(n: number) {
  return { value: newKey(), label: `ตัวเลือก ${n}` };
}

function toValues(form: FormDetail): QuestionValues[] {
  return form.questions.map((q) => ({
    uiKey: q.id,
    text: q.text,
    helpText: q.helpText ?? "",
    answerType: q.answerType,
    options: q.options ?? [],
    weight: q.weight,
    required: q.required,
    visibleTo: q.visibleTo,
  }));
}

/** Loads one form and hands it to the editor. */
export function FormEditorPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useAppraisalForm(id);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  return <FormEditor key={data.data.id} form={data.data} />;
}

function FormEditor({ form }: { form: FormDetail }) {
  const router = useRouter();
  const { can } = useAuth();
  const locked = form.status !== "DRAFT";
  const canEdit = can("campaign:update") && !locked;

  const [name, setName] = useState(form.name);
  const [questions, setQuestions] = useState<QuestionValues[]>(() => toValues(form));
  const [rater, setRater] = useState<RaterType>("MANAGER");

  const save = useSaveAppraisalForm(form.id);
  const publish = usePublishAppraisalForm(form.id);
  const newVersion = useNewAppraisalFormVersion(form.id);
  const busy = save.isPending || publish.isPending;

  const problems = formProblems(questions);
  const weightTotal = ratingWeightTotal(questions);

  const update = (i: number, patch: Partial<QuestionValues>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function payload() {
    return {
      name: name.trim() || form.name,
      questions: questions.map((q) => ({
        text: q.text,
        helpText: q.helpText || null,
        answerType: q.answerType,
        options: CHOICE.has(q.answerType) ? q.options : null,
        weight: q.weight,
        required: q.required,
        visibleTo: q.visibleTo,
      })),
    };
  }

  async function saveDraft(): Promise<boolean> {
    try {
      await save.mutateAsync(payload());
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      return false;
    }
  }

  async function onSave() {
    if (await saveDraft()) toast.success("บันทึกฉบับร่างแล้ว");
  }

  async function onPublish() {
    if (!(await saveDraft())) return;
    try {
      await publish.mutateAsync();
      toast.success("ยืนยันใช้แบบนี้แล้ว");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ยืนยันใช้ไม่สำเร็จ");
    }
  }

  async function onNewVersion() {
    try {
      const res = await newVersion.mutateAsync();
      router.push(`/appraisal/forms/${res.data.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "สร้างเวอร์ชันใหม่ไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeaderBar
        breadcrumbs={[{ label: "ประเมิน", href: "/appraisal/forms" }, { label: "แบบประเมิน", href: "/appraisal/forms" }, { label: name || "แบบประเมิน" }]}
        backHref="/appraisal/forms"
        title={name || "แบบประเมิน"}
        description={`เวอร์ชัน ${form.version}`}
        status={<StatusChip tone={locked ? "success" : "warning"} label={STATUS_LABEL[form.status]} />}
        sticky={false}
      />

      {locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">แบบนี้ถูกใช้งานแล้ว แก้ไขไม่ได้ ถ้าต้องการเปลี่ยน ให้สร้างเวอร์ชันใหม่</p>
          {can("campaign:create") && form.status === "PUBLISHED" && (
            <Button className="h-11 md:h-9" onClick={onNewVersion} disabled={newVersion.isPending}>
              สร้างเวอร์ชันใหม่
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-3">
          <Card className="gap-2 p-4">
            <label htmlFor="form-name" className="text-sm font-medium">
              ชื่อแบบประเมิน
            </label>
            <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={200} />
          </Card>

          {questions.map((q, i) => (
            <Card key={q.uiKey} className="gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">ข้อ {i + 1}</h2>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`เลื่อนข้อ ${i + 1} ขึ้น`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`เลื่อนข้อ ${i + 1} ลง`} disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-11 md:size-9" aria-label={`ลบข้อ ${i + 1}`} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Input aria-label={`คำถามข้อ ${i + 1}`} placeholder="พิมพ์คำถาม" value={q.text} onChange={(e) => update(i, { text: e.target.value })} disabled={!canEdit} maxLength={500} />
              <Input aria-label={`ตัวอย่างพฤติกรรมข้อ ${i + 1}`} placeholder="ตัวอย่างพฤติกรรม (ไม่บังคับ)" value={q.helpText} onChange={(e) => update(i, { helpText: e.target.value })} disabled={!canEdit} maxLength={500} />

              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={q.answerType}
                  disabled={!canEdit}
                  onValueChange={(v) => {
                    const type = v as AnswerType;
                    update(i, {
                      answerType: type,
                      options: CHOICE.has(type) && q.options.length < 2 ? [emptyOption(1), emptyOption(2)] : q.options,
                    });
                  }}
                >
                  <SelectTrigger className="h-11 w-auto min-w-[160px] md:h-9" aria-label={`ประเภทคำตอบข้อ ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ANSWER_TYPE_LABEL) as AnswerType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {ANSWER_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {q.answerType === "RATING" ? (
                  <label className="flex items-center gap-2 text-sm">
                    น้ำหนัก
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="h-11 w-20 md:h-9"
                      value={q.weight}
                      onChange={(e) => update(i, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      disabled={!canEdit}
                    />
                  </label>
                ) : (
                  <StatusChip tone="neutral" dot={false} label="ไม่นับคะแนน" />
                )}

                <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-0">
                  <Checkbox checked={q.required} onCheckedChange={(c) => update(i, { required: c === true })} disabled={!canEdit} />
                  ต้องตอบ
                </label>
              </div>

              {CHOICE.has(q.answerType) && (
                <div className="space-y-2">
                  {q.options.map((o, oi) => (
                    <div key={o.value} className="flex items-center gap-2">
                      <Input
                        aria-label={`ตัวเลือกที่ ${oi + 1} ของข้อ ${i + 1}`}
                        value={o.label}
                        disabled={!canEdit}
                        maxLength={120}
                        onChange={(e) => update(i, { options: q.options.map((x, k) => (k === oi ? { ...x, label: e.target.value } : x)) })}
                      />
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" aria-label={`ลบตัวเลือกที่ ${oi + 1}`} onClick={() => update(i, { options: q.options.filter((_, k) => k !== oi) })}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button variant="outline" className="h-11 md:h-9" onClick={() => update(i, { options: [...q.options, emptyOption(q.options.length + 1)] })}>
                      <Plus className="size-4" /> เพิ่มตัวเลือก
                    </Button>
                  )}
                </div>
              )}

              <fieldset className="space-y-1.5">
                <legend className="text-sm text-muted-foreground">ใครเห็นคำถามนี้ (ไม่เลือก = ทุกคน)</legend>
                <div className="flex flex-wrap gap-2">
                  {RATERS.map((r) => {
                    const on = q.visibleTo.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        disabled={!canEdit}
                        onClick={() => update(i, { visibleTo: on ? q.visibleTo.filter((x) => x !== r) : [...q.visibleTo, r] })}
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-sm font-medium md:min-h-8 md:px-3",
                          on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-foreground",
                          "disabled:opacity-60",
                        )}
                      >
                        {RATER_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Card>
          ))}

          {canEdit && (
            <Button variant="outline" className="h-11 w-full md:h-9 md:w-auto" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
              <Plus className="size-4" /> เพิ่มคำถาม
            </Button>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <Card className="gap-2 p-4" aria-label="ความพร้อมของแบบ">
            <h2 className="text-sm font-semibold">ความพร้อมก่อนยืนยันใช้</h2>
            {problems.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <CircleCheck className="size-4" aria-hidden="true" /> พร้อมยืนยันใช้ ({questions.length} คำถาม)
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {problems.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-warning">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              คำถามให้คะแนน: น้ำหนักรวม {weightTotal} · สเกล 1–{form.ratingMax} (ค่าเริ่มต้น รอ HR ยืนยัน)
            </p>
          </Card>

          <Card className="gap-3 p-4" aria-label="ตัวอย่างหน้าจอผู้ประเมิน">
            <h2 className="text-sm font-semibold">ตัวอย่างที่ผู้ประเมินเห็น</h2>
            <div role="group" aria-label="ดูในมุมของ" className="flex gap-1 rounded-full bg-muted p-1">
              {RATERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rater === r}
                  onClick={() => setRater(r)}
                  className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", rater === r && "bg-card shadow-sm")}
                >
                  {RATER_LABEL[r]}
                </button>
              ))}
            </div>
            <Preview questions={questions} rater={rater} ratingMax={form.ratingMax} />
          </Card>
        </aside>
      </div>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:left-[var(--sidebar-width,0px)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2">
            <Button variant="outline" className="h-11 md:h-9" onClick={onSave} disabled={busy}>
              บันทึกฉบับร่าง
            </Button>
            <Button className="h-11 md:h-9" onClick={onPublish} disabled={busy || problems.length > 0}>
              ยืนยันใช้แบบนี้
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only picture of the form as one rater type would see it. */
function Preview({ questions, rater, ratingMax }: { questions: QuestionValues[]; rater: RaterType; ratingMax: number }) {
  const visible = questions.filter((q) => q.visibleTo.length === 0 || q.visibleTo.includes(rater));
  const rubric = SCORE_RUBRIC.filter((r) => r.score <= ratingMax);
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">ยังไม่มีคำถามที่ {RATER_LABEL[rater]} เห็น</p>;
  return (
    <ol className="max-h-[420px] space-y-4 overflow-y-auto rounded-2xl border border-border p-3 text-sm">
      {visible.map((q, i) => (
        <li key={q.uiKey} className="space-y-2">
          <p className="font-semibold">
            {i + 1}. {q.text || "(ยังไม่ได้พิมพ์คำถาม)"}
            {q.required && <span className="text-destructive"> *</span>}
          </p>
          {q.helpText && <p className="text-xs text-muted-foreground">{q.helpText}</p>}
          {q.answerType === "RATING" &&
            rubric.map((r) => (
              <div key={r.score} className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-accent-foreground">{r.score}</span>
                <span>{r.label}</span>
              </div>
            ))}
          {CHOICE.has(q.answerType) &&
            q.options.map((o) => (
              <div key={o.value} className="flex items-center gap-2 rounded-xl border border-border px-2 py-1.5">
                <span className={cn("size-4 shrink-0 border border-input", q.answerType === "CHOICE" ? "rounded-full" : "rounded-[4px]")} aria-hidden="true" />
                <span>{o.label || "(ว่าง)"}</span>
              </div>
            ))}
          {(q.answerType === "SHORT_TEXT" || q.answerType === "PARAGRAPH") && (
            <div className={cn("rounded-xl border border-dashed border-border px-2 text-xs text-muted-foreground", q.answerType === "PARAGRAPH" ? "py-6" : "py-2")}>
              พื้นที่พิมพ์คำตอบ
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
