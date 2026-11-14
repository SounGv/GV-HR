"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { BackLink } from "@/components/shared/back-link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Copy,
  GripVertical,
  Library,
  Lock,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableLoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { QuestionStep, scoreTone } from "@/features/appraisal-round/task-form";
import type { AnswerValue, SnapQuestion } from "@/features/appraisal-round/answers";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  useAppraisalForm,
  useNewAppraisalFormVersion,
  usePublishAppraisalForm,
  useQuestionBank,
  useRemoveBankItem,
  useSaveAppraisalForm,
} from "./hooks";
import { rubricFor, type RatingLabel } from "./rating-labels";
import { formProblems } from "./rules";
import {
  ANSWER_TYPE_LABEL,
  RATER_LABEL,
  STATUS_LABEL,
  type AnswerType,
  type BankItem,
  type FormDetail,
  type QuestionValues,
  type RaterType,
} from "./types";

/*
 * Form builder (form-builder-mock.html): sections and topics on the left (add,
 * rename, reorder by drag or arrows, delete with undo), the selected topic in
 * the middle, the scale (2–5 scores, add / rename / remove), answering rules,
 * readiness and a live phone preview on the right. Topics can be picked from
 * the question bank (คลังหัวข้อ), which fills itself whenever a form is published.
 */

const RATERS = Object.keys(RATER_LABEL) as RaterType[];
const CHOICE = new Set<AnswerType>(["CHOICE", "MULTI_CHOICE"]);
const MAX_LEVELS = 5;
const MIN_LEVELS = 2;
/** Ready-made scales, lowest score first. */
const SCALE_SETS: Record<number, string[]> = {
  3: ["ปรับปรุง", "ได้ตามที่คาด", "เกินคาด"],
  4: ["ต้องปรับปรุง", "พอใช้", "ดี", "ดีมาก"],
  5: ["ปรับปรุง", "พอใช้", "ปานกลาง", "ดี", "ดีมาก"],
};

interface Section {
  key: string;
  name: string;
  qs: QuestionValues[];
}

const newKey = () => crypto.randomUUID();
const blankQuestion = (): QuestionValues => ({
  uiKey: newKey(),
  text: "",
  helpText: "",
  answerType: "RATING",
  options: [],
  weight: 1,
  required: true,
  visibleTo: [],
  levels: {},
});
const emptyOption = (n: number) => ({ value: newKey(), label: `ตัวเลือก ${n}` });

/** Consecutive questions with the same section name form one section; a form with none gets one unnamed section. */
function toSections(form: FormDetail): Section[] {
  const out: Section[] = [];
  for (const q of form.questions) {
    const name = q.section ?? "";
    const v: QuestionValues = {
      uiKey: q.id,
      text: q.text,
      helpText: q.helpText ?? "",
      answerType: q.answerType,
      options: q.options ?? [],
      weight: q.weight,
      required: q.required,
      visibleTo: q.visibleTo,
      levels: Object.fromEntries((q.levelDescriptions ?? []).map((l) => [l.score, l.text])),
    };
    const last = out[out.length - 1];
    if (last && last.name === name) last.qs.push(v);
    else out.push({ key: newKey(), name, qs: [v] });
  }
  return out.length ? out : [{ key: newKey(), name: "", qs: [] }];
}

/** A question text listing several things ("ปริมาณ, คุณภาพ, ตรงเวลา") is probably several questions. */
const splitParts = (text: string) =>
  text
    .split(/,|\/| และ /)
    .map((t) => t.trim())
    .filter(Boolean);
const looksCombined = (text: string) => splitParts(text).length >= 3;
const hasLevels = (q: QuestionValues) => Object.values(q.levels).some((t) => t.trim());
/** Loads one form and hands it to the editor. */
export function FormEditorPage({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useAppraisalForm(id);
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableLoadingState rows={4} />;
  return <FormEditor key={`${data.data.id}-${data.data.status}`} form={data.data} />;
}

function FormEditor({ form }: { form: FormDetail }) {
  const router = useRouter();
  const { can } = useAuth();
  const locked = form.status !== "DRAFT";
  const canEdit = can("campaign:update") && !locked;

  const [name, setName] = useState(form.name);
  const [sections, setSections] = useState<Section[]>(() => toSections(form));
  // Scale: explicit names, lowest score first. `custom` stays false while a form that uses the system names is untouched.
  const [labels, setLabels] = useState<RatingLabel[]>(
    () =>
      form.ratingLabels ??
      rubricFor(form.ratingMax, null)
        .map((r) => ({ score: r.score, label: r.label }))
        .reverse(),
  );
  const [custom, setCustom] = useState(form.ratingLabels !== null);
  const [noteAtLowest, setNoteAtLowest] = useState(form.noteAtLowest);
  const [sel, setSel] = useState<string | null>(() => form.questions[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const save = useSaveAppraisalForm(form.id);
  const publish = usePublishAppraisalForm(form.id);
  const newVersion = useNewAppraisalFormVersion(form.id);
  const busy = save.isPending || publish.isPending;

  const ratingMax = labels.length;
  const flat = useMemo(() => sections.flatMap((s) => s.qs.map((q) => ({ q, s }))), [sections]);
  const current = flat.find((x) => x.q.uiKey === sel) ?? null;
  const problems = [
    ...formProblems(flat.map((x) => x.q)),
    ...(labels.some((l) => !l.label.trim()) ? ["ตั้งชื่อระดับคะแนนให้ครบทุกระดับ"] : []),
  ];
  const advice = [
    ...flat.flatMap((x, i) =>
      x.q.answerType === "RATING" && !hasLevels(x.q)
        ? [`ข้อ ${i + 1} ยังไม่มีคำอธิบายรายคะแนน`]
        : [],
    ),
    ...flat.flatMap((x, i) => (looksCombined(x.q.text) ? [`ข้อ ${i + 1} อาจรวมหลายเรื่อง`] : [])),
  ];

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /** Every edit goes through here so the page knows it has unsaved changes. */
  function edit(fn: (s: Section[]) => Section[]) {
    setSections((cur) => fn(structuredClone(cur)));
    setDirty(true);
  }
  function patchQ(key: string, patch: Partial<QuestionValues>) {
    edit((ss) =>
      ss.map((s) => ({ ...s, qs: s.qs.map((q) => (q.uiKey === key ? { ...q, ...patch } : q)) })),
    );
  }
  /** Keeps a copy so a delete / scale change can be undone from the toast. */
  function withUndo(message: string, change: () => void) {
    const before = {
      sections: structuredClone(sections),
      labels: structuredClone(labels),
      custom,
      sel,
    };
    change();
    toast(message, {
      action: {
        label: "เลิกทำ",
        onClick: () => {
          setSections(before.sections);
          setLabels(before.labels);
          setCustom(before.custom);
          setSel(before.sel);
          setDirty(true);
        },
      },
    });
  }

  /* ── sections and topics ── */
  function addSection() {
    const s: Section = { key: newKey(), name: "หมวดใหม่", qs: [blankQuestion()] };
    edit((ss) => [...ss, s]);
    setSel(s.qs[0].uiKey);
  }
  function addTopic(sectionKey: string, q: QuestionValues = blankQuestion()) {
    edit((ss) => ss.map((s) => (s.key === sectionKey ? { ...s, qs: [...s.qs, q] } : s)));
    setSel(q.uiKey);
  }
  function moveTopic(key: string, dir: -1 | 1) {
    edit((ss) => {
      const si = ss.findIndex((s) => s.qs.some((q) => q.uiKey === key));
      const arr = ss[si].qs;
      const i = arr.findIndex((q) => q.uiKey === key);
      const j = i + dir;
      if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]];
      else if (ss[si + dir]) {
        const [q] = arr.splice(i, 1);
        if (dir < 0) ss[si + dir].qs.push(q);
        else ss[si + dir].qs.unshift(q);
      }
      return ss;
    });
  }
  /** Drop `key` before `beforeKey`, or at the end of `sectionKey`. */
  function dropTopic(key: string, target: { beforeKey?: string; sectionKey?: string }) {
    if (key === target.beforeKey) return;
    edit((ss) => {
      let moving: QuestionValues | undefined;
      for (const s of ss) {
        const i = s.qs.findIndex((q) => q.uiKey === key);
        if (i >= 0) moving = s.qs.splice(i, 1)[0];
      }
      if (!moving) return ss;
      for (const s of ss) {
        if (target.beforeKey) {
          const i = s.qs.findIndex((q) => q.uiKey === target.beforeKey);
          if (i >= 0) {
            s.qs.splice(i, 0, moving);
            return ss;
          }
        } else if (s.key === target.sectionKey) {
          s.qs.push(moving);
          return ss;
        }
      }
      return ss;
    });
  }
  function deleteTopic(key: string) {
    const i = flat.findIndex((x) => x.q.uiKey === key);
    withUndo(`ลบหัวข้อ “${flat[i]?.q.text || "ไม่มีชื่อ"}” แล้ว`, () => {
      edit((ss) => ss.map((s) => ({ ...s, qs: s.qs.filter((q) => q.uiKey !== key) })));
      const next = flat[i + 1] ?? flat[i - 1];
      setSel(next && next.q.uiKey !== key ? next.q.uiKey : null);
    });
  }
  function copyTopic(key: string) {
    const c = {
      ...structuredClone(current!.q),
      uiKey: newKey(),
      text: `${current!.q.text} (สำเนา)`,
    };
    edit((ss) =>
      ss.map((s) => {
        const i = s.qs.findIndex((q) => q.uiKey === key);
        if (i >= 0) s.qs.splice(i + 1, 0, c);
        return s;
      }),
    );
    setSel(c.uiKey);
  }
  function splitTopic(key: string) {
    const q = current!.q;
    const parts = splitParts(q.text).map((text) => ({
      ...structuredClone(q),
      uiKey: newKey(),
      text,
      levels: {},
    }));
    withUndo(`แยกเป็น ${parts.length} หัวข้อแล้ว`, () => {
      edit((ss) =>
        ss.map((s) => {
          const i = s.qs.findIndex((x) => x.uiKey === key);
          if (i >= 0) s.qs.splice(i, 1, ...parts);
          return s;
        }),
      );
      setSel(parts[0].uiKey);
    });
  }
  function deleteSection(key: string) {
    const s = sections.find((x) => x.key === key)!;
    withUndo(`ลบหมวด “${s.name || "ไม่มีชื่อ"}” (${s.qs.length} หัวข้อ) แล้ว`, () => {
      edit((ss) => {
        const left = ss.filter((x) => x.key !== key);
        return left.length ? left : [{ key: newKey(), name: "", qs: [] }];
      });
      if (current && current.s.key === key) setSel(null);
    });
  }

  /* ── scale ── */
  function setScale(next: RatingLabel[], remap: (score: number) => number | null, message: string) {
    withUndo(message, () => {
      setLabels(next);
      setCustom(true);
      edit((ss) =>
        ss.map((s) => ({
          ...s,
          qs: s.qs.map((q) => ({
            ...q,
            levels: Object.fromEntries(
              Object.entries(q.levels).flatMap(([k, t]) => {
                const to = remap(Number(k));
                return to === null ? [] : [[to, t]];
              }),
            ),
          })),
        })),
      );
    });
  }
  const addLevel = () => {
    if (labels.length < MAX_LEVELS)
      setScale(
        [...labels, { score: labels.length + 1, label: "ระดับใหม่" }],
        (k) => k,
        "เพิ่มระดับคะแนนแล้ว",
      );
  };
  const removeLevel = (score: number) => {
    if (labels.length <= MIN_LEVELS) return;
    setScale(
      labels.filter((l) => l.score !== score).map((l, i) => ({ score: i + 1, label: l.label })),
      (k) => (k === score ? null : k > score ? k - 1 : k),
      `ลบระดับ “${labels.find((l) => l.score === score)?.label}” แล้ว`,
    );
  };
  /** Back to the system's own 1–5 names (they come with a short description each). */
  const applySystemNames = () => {
    setScale(
      rubricFor(5, null)
        .map((r) => ({ score: r.score, label: r.label }))
        .reverse(),
      (k) => (labels.length === 5 ? k : null),
      "ใช้ชื่อเดิมของระบบ (5 ระดับ)",
    );
    setCustom(false);
  };
  const applyPreset = (n: number) =>
    setScale(
      SCALE_SETS[n].map((label, i) => ({ score: i + 1, label })),
      (k) => (n === labels.length ? k : null),
      `เปลี่ยนเป็น ${n} ระดับ${n === labels.length ? "" : " (ล้างคำอธิบายรายคะแนน)"}`,
    );

  /* ── save / publish ── */
  function payload() {
    return {
      name: name.trim() || form.name,
      ratingMax,
      ratingLabels: custom ? labels : null,
      noteAtLowest,
      questions: flat.map(({ q, s }) => ({
        text: q.text,
        helpText: q.helpText || null,
        answerType: q.answerType,
        options: CHOICE.has(q.answerType) ? q.options : null,
        weight: q.weight,
        required: q.required,
        visibleTo: q.visibleTo,
        section: s.name.trim() || null,
        levelDescriptions:
          q.answerType === "RATING"
            ? Object.entries(q.levels)
                .filter(([, t]) => t.trim())
                .map(([score, text]) => ({ score: Number(score), text: text.trim() }))
            : null,
      })),
    };
  }
  async function saveDraft(): Promise<boolean> {
    try {
      await save.mutateAsync(payload());
      setDirty(false);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "บันทึกไม่สำเร็จ");
      return false;
    }
  }
  async function onPublish() {
    setConfirmPublish(false);
    if (!(await saveDraft())) return;
    try {
      await publish.mutateAsync();
      toast.success("ยืนยันใช้แบบนี้แล้ว หัวข้อถูกเก็บเข้าคลังด้วย");
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

  const ratingWeight =
    flat.filter((x) => x.q.answerType === "RATING").reduce((n, x) => n + x.q.weight, 0) || 1;

  return (
    <div className="space-y-4 pb-10">
      {/* Header: name, state, counts, the two actions. */}
      <section
        className="gv-hero flex flex-wrap items-center gap-4 p-4 sm:p-5"
        aria-label="แบบประเมิน"
      >
        <div className="min-w-0 flex-1">
          <BackLink href="/appraisal/forms" onHero>
            แบบประเมิน
          </BackLink>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              aria-label="ชื่อแบบประเมิน"
              value={name}
              disabled={!canEdit}
              maxLength={200}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="min-w-0 flex-1 border-0 border-b-[1.5px] border-dashed border-white/35 bg-transparent py-0.5 text-[22px] leading-snug font-bold text-white outline-none focus:border-[var(--on-hero-accent)] disabled:border-transparent sm:min-w-[260px]"
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold">
              <span
                className={cn("size-1.5 rounded-full", locked ? "bg-status-normal-dot" : "bg-status-late-dot")}
                aria-hidden="true"
              />
              {STATUS_LABEL[form.status]} · เวอร์ชัน {form.version}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2">
          {(
            [
              ["หัวข้อ", flat.length],
              ["หมวด", sections.filter((s) => s.name.trim()).length],
              ["ระดับ", ratingMax],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="gv-glass min-w-[64px] px-3 py-2">
              <dt className="text-xs text-white/80">{k}</dt>
              <dd className="text-xl leading-snug font-bold tabular-nums">{v}</dd>
            </div>
          ))}
          <div className="gv-glass min-w-[84px] px-3 py-2">
            <dt className="text-xs text-white/80">ความพร้อม</dt>
            <dd
              className="pt-0.5 text-base leading-snug font-bold"
              style={{ color: problems.length ? "var(--status-late-dot)" : undefined }}
            >
              {problems.length ? `ขาด ${problems.length}` : "พร้อม ✓"}
            </dd>
          </div>
        </dl>
        {canEdit && (
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              className="h-11 flex-1 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              disabled={busy}
              onClick={async () => {
                if (await saveDraft()) toast.success("บันทึกฉบับร่างแล้ว");
              }}
            >
              {save.isPending ? "กำลังบันทึก…" : dirty ? "บันทึกร่าง •" : "บันทึกร่าง"}
            </Button>
            <Button
              className="h-11 flex-1 bg-white font-bold text-[var(--on-hero-accent-fg)] hover:bg-white/90"
              disabled={busy || problems.length > 0}
              title={problems.join(" · ")}
              onClick={() => setConfirmPublish(true)}
            >
              ยืนยันใช้แบบนี้
            </Button>
          </div>
        )}
      </section>

      {locked && (
        <div className="border-border bg-muted flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            แบบนี้ถูกใช้งานแล้ว แก้ไขไม่ได้ ถ้าต้องการเปลี่ยน ให้สร้างเวอร์ชันใหม่
          </p>
          {can("campaign:create") && form.status === "PUBLISHED" && (
            <Button className="h-11 md:h-9" onClick={onNewVersion} disabled={newVersion.isPending}>
              สร้างเวอร์ชันใหม่
            </Button>
          )}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[290px_minmax(0,1fr)_340px]">
        <Outline
          sections={sections}
          sel={sel}
          ratingWeight={ratingWeight}
          canEdit={canEdit}
          onSelect={setSel}
          onAddSection={addSection}
          onAddTopic={(k) => addTopic(k)}
          onRenameSection={(k, v) =>
            edit((ss) => ss.map((s) => (s.key === k ? { ...s, name: v } : s)))
          }
          onMoveSection={(k) =>
            edit((ss) => {
              const i = ss.findIndex((s) => s.key === k);
              if (i > 0) [ss[i - 1], ss[i]] = [ss[i], ss[i - 1]];
              return ss;
            })
          }
          onDeleteSection={deleteSection}
          onDrop={dropTopic}
          onOpenBank={() => setBankOpen(true)}
        />

        <Card className="gap-0 rounded-[20px] p-0" aria-label="แก้ไขหัวข้อ">
          {current ? (
            <TopicEditor
              key={current.q.uiKey}
              q={current.q}
              index={flat.findIndex((x) => x.q.uiKey === current.q.uiKey)}
              total={flat.length}
              sectionName={current.s.name}
              labels={labels}
              canEdit={canEdit}
              onPatch={(p) => patchQ(current.q.uiKey, p)}
              onMove={(d) => moveTopic(current.q.uiKey, d)}
              onCopy={() => copyTopic(current.q.uiKey)}
              onDelete={() => deleteTopic(current.q.uiKey)}
              onSplit={() => splitTopic(current.q.uiKey)}
            />
          ) : (
            <div className="text-muted-foreground px-6 py-16 text-center text-sm">
              เลือกหัวข้อทางซ้าย
              {canEdit && (
                <>
                  {" "}
                  หรือ{" "}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:underline"
                    onClick={() => addTopic(sections[sections.length - 1].key)}
                  >
                    เพิ่มหัวข้อใหม่
                  </button>
                </>
              )}
            </div>
          )}
        </Card>

        <aside className="grid gap-4 lg:col-span-2 lg:grid-cols-2 2xl:sticky 2xl:top-4 2xl:col-span-1 2xl:grid-cols-1">
          <div className="grid content-start gap-4">
            <ScaleCard
              labels={labels}
              canEdit={canEdit}
              onRename={(score, v) => {
                setLabels((ls) => ls.map((l) => (l.score === score ? { ...l, label: v } : l)));
                setCustom(true);
                setDirty(true);
              }}
              onAdd={addLevel}
              onRemove={removeLevel}
              onPreset={applyPreset}
              onSystem={applySystemNames}
              usingSystem={!custom}
            />
            <Card className="gap-3 rounded-[20px] p-4" aria-label="กติกาและความพร้อม">
              <h2 className="gv-bar-heading flex items-center gap-2 text-sm font-semibold">
                กติกาตอนตอบ
              </h2>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <Switch
                  className="mt-0.5"
                  checked={noteAtLowest}
                  disabled={!canEdit}
                  onCheckedChange={(v) => {
                    setNoteAtLowest(v === true);
                    setDirty(true);
                  }}
                />
                <span>
                  ให้ “{labels[0]?.label}” ต้องเขียนตัวอย่างเหตุการณ์
                  <span className="text-muted-foreground block text-xs">
                    พนักงานรู้ว่าต้องแก้อะไร และ HR ใช้ประกอบตอนตรวจผล
                  </span>
                </span>
              </label>
              <div className="border-border border-t pt-3">
                <h3 className="mb-1.5 text-sm font-semibold">ความพร้อมก่อนยืนยันใช้</h3>
                {problems.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-success">
                    <CircleCheck className="size-4" aria-hidden="true" /> พร้อมยืนยันใช้ (
                    {flat.length} หัวข้อ)
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm text-status-late-fg">
                    {problems.map((p) => (
                      <li key={p} className="flex gap-2">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                {advice.length > 0 && (
                  <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                    {advice.slice(0, 5).map((a) => (
                      <li key={a}>แนะนำ: {a}</li>
                    ))}
                    {advice.length > 5 && <li>และอีก {advice.length - 5} ข้อ</li>}
                  </ul>
                )}
              </div>
            </Card>
          </div>
          <PhonePreview
            flat={flat}
            labels={labels}
            custom={custom}
            noteAtLowest={noteAtLowest}
            formName={name}
            sel={sel}
          />
        </aside>
      </div>

      <BankPicker
        open={bankOpen}
        onOpenChange={setBankOpen}
        ratingMax={ratingMax}
        usedTexts={new Set(flat.map((x) => x.q.text.trim()))}
        canEdit={canEdit}
        onPick={(b) => {
          const target = current?.s.key ?? sections[sections.length - 1].key;
          const levels =
            b.answerType === "RATING" && b.scaleMax === ratingMax
              ? Object.fromEntries((b.levelDescriptions ?? []).map((l) => [l.score, l.text]))
              : {};
          addTopic(target, {
            ...blankQuestion(),
            text: b.text,
            helpText: b.helpText ?? "",
            answerType: b.answerType,
            weight: b.answerType === "RATING" ? 1 : 0,
            levels,
          });
          const dropped =
            b.answerType === "RATING" && b.scaleMax !== ratingMax && b.levelDescriptions;
          toast.success(
            `เพิ่ม “${b.text}” แล้ว${dropped ? ` (คำอธิบายเขียนไว้สำหรับ ${b.scaleMax} ระดับ จึงไม่ได้ใส่มา)` : ""}`,
          );
        }}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="ยืนยันใช้แบบนี้?"
        description={`ยืนยันแล้วแก้ไม่ได้ (แก้ได้โดยสร้างเวอร์ชันใหม่) · ${flat.length} หัวข้อจะถูกเก็บเข้าคลังหัวข้อด้วย`}
        confirmLabel="ยืนยันใช้"
        onConfirm={onPublish}
        loading={busy}
      />
    </div>
  );
}

/* ───────────────────────── outline ───────────────────────── */

function Outline({
  sections,
  sel,
  ratingWeight,
  canEdit,
  onSelect,
  onAddSection,
  onAddTopic,
  onRenameSection,
  onMoveSection,
  onDeleteSection,
  onDrop,
  onOpenBank,
}: {
  sections: Section[];
  sel: string | null;
  ratingWeight: number;
  canEdit: boolean;
  onSelect: (k: string) => void;
  onAddSection: () => void;
  onAddTopic: (sectionKey: string) => void;
  onRenameSection: (k: string, v: string) => void;
  onMoveSection: (k: string) => void;
  onDeleteSection: (k: string) => void;
  onDrop: (key: string, target: { beforeKey?: string; sectionKey?: string }) => void;
  onOpenBank: () => void;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  let n = 0;

  const dropProps = (target: { beforeKey?: string; sectionKey?: string }, id: string) =>
    canEdit
      ? {
          onDragOver: (e: DragEvent) => {
            if (!dragKey) return;
            e.preventDefault();
            setOver(id);
          },
          onDragLeave: () => setOver((o) => (o === id ? null : o)),
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            if (dragKey) onDrop(dragKey, target);
            setDragKey(null);
            setOver(null);
          },
        }
      : {};

  return (
    <Card className="gap-0 rounded-[20px] p-0 lg:sticky lg:top-4" aria-label="โครงแบบประเมิน">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h2 className="gv-bar-heading flex items-center gap-2 text-sm font-semibold">
          โครงแบบประเมิน
        </h2>
        {canEdit && (
          <Button
            variant="outline"
            className="ml-auto h-9 px-2.5 text-sm"
            onClick={onAddSection}
          >
            <Plus className="size-4" aria-hidden="true" /> หมวด
          </Button>
        )}
      </div>
      {canEdit && (
        <div className="px-3 pb-2">
          <Button
            variant="outline"
            className="h-10 w-full justify-start border-dashed text-sm text-primary"
            onClick={onOpenBank}
          >
            <Library className="size-4" aria-hidden="true" /> หยิบจากคลังหัวข้อ
          </Button>
        </div>
      )}
      <div className="max-h-[70vh] overflow-y-auto px-2 pb-3">
        {sections.map((s, si) => {
          const sw = s.qs
            .filter((q) => q.answerType === "RATING")
            .reduce((a, q) => a + q.weight, 0);
          const pct = Math.round((sw / ratingWeight) * 100);
          return (
            <div key={s.key} className="mb-2 rounded-2xl">
              <div className="flex items-center gap-1 px-2 pt-1.5">
                {renaming === s.key ? (
                  <Input
                    autoFocus
                    aria-label="ชื่อหมวด"
                    className="h-8 text-sm"
                    value={s.name}
                    maxLength={80}
                    onChange={(e) => onRenameSection(s.key, e.target.value)}
                    onBlur={() => setRenaming(null)}
                    onKeyDown={(e) => e.key === "Enter" && setRenaming(null)}
                  />
                ) : (
                  <b
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      !s.name && "text-muted-foreground font-medium",
                    )}
                  >
                    {s.name || "ไม่จัดหมวด"}
                  </b>
                )}
                {sw > 0 && (
                  <span className="shrink-0 rounded-full bg-accent px-2 text-xs font-bold text-primary tabular-nums">
                    {pct}%
                  </span>
                )}
                {canEdit && (
                  <>
                    <IconBtn label="เปลี่ยนชื่อหมวด" onClick={() => setRenaming(s.key)}>
                      <Pencil className="size-3.5" />
                    </IconBtn>
                    <IconBtn
                      label="เลื่อนหมวดขึ้น"
                      disabled={si === 0}
                      onClick={() => onMoveSection(s.key)}
                    >
                      <ArrowUp className="size-3.5" />
                    </IconBtn>
                    <IconBtn label="ลบหมวด" danger onClick={() => onDeleteSection(s.key)}>
                      <Trash2 className="size-3.5" />
                    </IconBtn>
                  </>
                )}
              </div>
              {sw > 0 && (
                <div
                  className="bg-muted mx-2 mt-1 mb-1.5 h-[5px] overflow-hidden rounded-full"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-[linear-gradient(90deg,var(--ring),var(--primary))] transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {s.qs.length === 0 && (
                <p className="text-muted-foreground px-3 py-1 text-xs">หมวดว่างจะไม่ถูกบันทึก</p>
              )}
              {s.qs.map((q) => {
                n++;
                const warn = (q.answerType === "RATING" && !hasLevels(q)) || looksCombined(q.text);
                return (
                  <div key={q.uiKey} {...dropProps({ beforeKey: q.uiKey }, q.uiKey)}>
                    {over === q.uiKey && (
                      <div className="mx-2 h-[3px] rounded bg-ring" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      draggable={canEdit}
                      onDragStart={() => setDragKey(q.uiKey)}
                      onDragEnd={() => {
                        setDragKey(null);
                        setOver(null);
                      }}
                      onClick={() => onSelect(q.uiKey)}
                      aria-current={sel === q.uiKey ? "true" : undefined}
                      className={cn(
                        "flex min-h-10 w-full items-center gap-2 rounded-xl border-[1.5px] px-2 py-1.5 text-left text-sm transition-colors",
                        sel === q.uiKey
                          ? "border-ring/40 bg-accent"
                          : "hover:bg-muted/60 border-transparent",
                        dragKey === q.uiKey && "opacity-40",
                      )}
                    >
                      {canEdit && (
                        <GripVertical
                          className="text-muted-foreground/60 size-4 shrink-0 cursor-grab"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={cn(
                          "flex size-[22px] shrink-0 items-center justify-center rounded-[7px] text-xs font-bold tabular-nums",
                          sel === q.uiKey ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {n}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          !q.text && "text-muted-foreground",
                        )}
                      >
                        {q.text || "(ยังไม่มีชื่อ)"}
                      </span>
                      {warn && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-status-late-dot"
                          title="มีคำแนะนำ"
                          aria-label="มีคำแนะนำ"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
              {canEdit && (
                <div {...dropProps({ sectionKey: s.key }, `end-${s.key}`)}>
                  {over === `end-${s.key}` && (
                    <div className="mx-2 h-[3px] rounded bg-ring" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => onAddTopic(s.key)}
                    className="border-border hover:bg-accent mt-0.5 flex min-h-9 w-full items-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-2.5 text-sm font-semibold text-primary hover:border-ring hover:bg-accent"
                  >
                    <Plus className="size-3.5" aria-hidden="true" /> เพิ่มหัวข้อ
                    {s.name ? `ใน${s.name}` : ""}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
        danger ? "hover:bg-destructive-muted hover:text-destructive" : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* ───────────────────────── topic editor ───────────────────────── */

const TYPE_ORDER: AnswerType[] = ["RATING", "CHOICE", "MULTI_CHOICE", "SHORT_TEXT", "PARAGRAPH"];

function TopicEditor({
  q,
  index,
  total,
  sectionName,
  labels,
  canEdit,
  onPatch,
  onMove,
  onCopy,
  onDelete,
  onSplit,
}: {
  q: QuestionValues;
  index: number;
  total: number;
  sectionName: string;
  labels: RatingLabel[];
  canEdit: boolean;
  onPatch: (p: Partial<QuestionValues>) => void;
  onMove: (dir: -1 | 1) => void;
  onCopy: () => void;
  onDelete: () => void;
  onSplit: () => void;
}) {
  const parts = splitParts(q.text);
  return (
    <div className="gv-rise">
      <div className="border-border flex items-center gap-2 border-b px-5 py-3">
        <h2 className="gv-bar-heading flex min-w-0 items-center gap-2 text-sm font-semibold">
          หัวข้อ {index + 1} จาก {total}
          {sectionName && (
            <span className="text-muted-foreground truncate font-medium">· {sectionName}</span>
          )}
        </h2>
        {canEdit && (
          <span className="ml-auto flex">
            <IconBtn label="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" />
            </IconBtn>
            <IconBtn label="เลื่อนลง" disabled={index === total - 1} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" />
            </IconBtn>
            <IconBtn label="ทำสำเนา" onClick={onCopy}>
              <Copy className="size-4" />
            </IconBtn>
            <IconBtn label="ลบหัวข้อ" danger onClick={onDelete}>
              <Trash2 className="size-4" />
            </IconBtn>
          </span>
        )}
      </div>

      <div className="space-y-4 p-5">
        <label className="block">
          <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
            ชื่อหัวข้อ
          </span>
          <Input
            value={q.text}
            disabled={!canEdit}
            maxLength={500}
            placeholder="เช่น ปริมาณและคุณภาพงาน"
            className="h-12 text-base font-bold"
            onChange={(e) => onPatch({ text: e.target.value })}
          />
        </label>
        {parts.length >= 3 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-status-late-border bg-status-late-bg px-3 py-2 text-sm text-status-late-fg">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              หัวข้อนี้มีหลายเรื่องในข้อเดียว ถ้าคนเก่งเรื่องหนึ่งแต่อ่อนอีกเรื่องจะให้คะแนนยาก
            </span>
            {canEdit && (
              <Button variant="outline" className="bg-card h-9" onClick={onSplit}>
                <Scissors className="size-4" aria-hidden="true" /> แยกเป็น {parts.length} หัวข้อ
              </Button>
            )}
          </div>
        )}
        <label className="block">
          <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
            ดูจากอะไร <span className="text-muted-foreground font-medium">(ไม่บังคับ)</span>
          </span>
          {/* Several lines: HR writes 1. 2. 3. lists here, which a one-line box cut off. */}
          <Textarea
            value={q.helpText}
            disabled={!canEdit}
            maxLength={500}
            rows={3}
            placeholder="เช่น งานที่ส่ง ความถูกต้อง กำหนดส่ง"
            className="min-h-20 text-base leading-relaxed md:text-sm"
            onChange={(e) => onPatch({ helpText: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div>
            <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
              ประเภทคำตอบ
            </span>
            <div
              role="radiogroup"
              aria-label="ประเภทคำตอบ"
              className="bg-muted inline-flex flex-wrap gap-0.5 rounded-xl p-1"
            >
              {TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={q.answerType === t}
                  disabled={!canEdit}
                  onClick={() =>
                    onPatch({
                      answerType: t,
                      weight: t === "RATING" ? Math.max(1, q.weight) : 0,
                      options:
                        CHOICE.has(t) && q.options.length < 2
                          ? [emptyOption(1), emptyOption(2)]
                          : q.options,
                    })
                  }
                  className={cn(
                    "text-muted-foreground min-h-9 rounded-[9px] px-3 text-sm font-semibold disabled:opacity-60",
                    q.answerType === t && "bg-card text-foreground shadow-sm",
                  )}
                >
                  {ANSWER_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {q.answerType === "RATING" && (
            <div>
              <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
                น้ำหนัก
              </span>
              <div className="border-border inline-flex h-10 items-center overflow-hidden rounded-xl border-[1.5px]">
                <button
                  type="button"
                  aria-label="ลดน้ำหนัก"
                  disabled={!canEdit || q.weight <= 1}
                  onClick={() => onPatch({ weight: q.weight - 1 })}
                  className="bg-muted/60 h-full w-10 text-lg font-bold disabled:opacity-40"
                >
                  −
                </button>
                <b className="min-w-10 text-center tabular-nums">{q.weight}</b>
                <button
                  type="button"
                  aria-label="เพิ่มน้ำหนัก"
                  disabled={!canEdit || q.weight >= 10}
                  onClick={() => onPatch({ weight: q.weight + 1 })}
                  className="bg-muted/60 h-full w-10 text-lg font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <Switch
              checked={q.required}
              disabled={!canEdit}
              onCheckedChange={(v) => onPatch({ required: v === true })}
            />
            ต้องตอบ
          </label>
        </div>

        <div>
          <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
            ใครตอบหัวข้อนี้{" "}
            <span className="text-muted-foreground font-medium">(ไม่เลือก = ทุกคน)</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RATERS.map((r) => {
              const on = q.visibleTo.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  disabled={!canEdit}
                  onClick={() =>
                    onPatch({
                      visibleTo: on ? q.visibleTo.filter((x) => x !== r) : [...q.visibleTo, r],
                    })
                  }
                  className={cn(
                    "min-h-9 rounded-full border-[1.5px] px-3.5 text-sm font-semibold disabled:opacity-60",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  {RATER_LABEL[r]}
                </button>
              );
            })}
          </div>
        </div>

        {q.answerType === "RATING" && (
          <div>
            <span className="text-foreground/80 mb-1.5 block text-sm font-bold">
              แต่ละคะแนนหมายถึงพฤติกรรมแบบไหน
            </span>
            <ul className="border-border overflow-hidden rounded-2xl border">
              {[...labels].reverse().map((l) => (
                <li
                  key={l.score}
                  className="border-border grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-t px-3 py-2.5 first:border-t-0 sm:grid-cols-[auto_120px_minmax(0,1fr)]"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-[11px] text-base font-bold",
                      scoreTone(l.score, labels.length),
                    )}
                  >
                    {l.score}
                  </span>
                  <span className="pt-2 text-sm font-bold">{l.label}</span>
                  <Textarea
                    rows={1}
                    disabled={!canEdit}
                    maxLength={300}
                    aria-label={`คะแนน ${l.score} ${l.label} หมายถึง`}
                    value={q.levels[l.score] ?? ""}
                    placeholder={
                      l.score === labels.length
                        ? "เช่น ทำได้มากกว่าเป้าอย่างสม่ำเสมอ"
                        : l.score === 1
                          ? "เช่น งานล่าช้าหรือผิดบ่อย ต้องมีคนตามแก้"
                          : "เช่น ทำได้ครบตามเป้า ผิดพลาดน้อย"
                    }
                    className="col-span-2 min-h-10 resize-y text-sm sm:col-span-1"
                    onChange={(e) =>
                      onPatch({ levels: { ...q.levels, [l.score]: e.target.value } })
                    }
                  />
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-1.5 text-xs">
              ผู้ประเมินเห็นใต้ปุ่มคะแนน ช่วยให้หัวหน้าทุกคนให้คะแนนด้วยมาตรฐานเดียวกัน
            </p>
          </div>
        )}

        {CHOICE.has(q.answerType) && (
          <div className="space-y-2">
            <span className="text-foreground/80 block text-sm font-bold">ตัวเลือก</span>
            {q.options.map((o, oi) => (
              <div key={o.value} className="flex items-center gap-2">
                <Input
                  aria-label={`ตัวเลือกที่ ${oi + 1}`}
                  value={o.label}
                  disabled={!canEdit}
                  maxLength={120}
                  className="h-11"
                  onChange={(e) =>
                    onPatch({
                      options: q.options.map((x, k) =>
                        k === oi ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                {canEdit && (
                  <IconBtn
                    label={`ลบตัวเลือกที่ ${oi + 1}`}
                    danger
                    onClick={() => onPatch({ options: q.options.filter((_, k) => k !== oi) })}
                  >
                    <Trash2 className="size-4" />
                  </IconBtn>
                )}
              </div>
            ))}
            {canEdit && (
              <Button
                variant="outline"
                className="h-10 border-dashed"
                onClick={() =>
                  onPatch({ options: [...q.options, emptyOption(q.options.length + 1)] })
                }
              >
                <Plus className="size-4" aria-hidden="true" /> เพิ่มตัวเลือก
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── scale ───────────────────────── */

function ScaleCard({
  labels,
  canEdit,
  onRename,
  onAdd,
  onRemove,
  onPreset,
  onSystem,
  usingSystem,
}: {
  labels: RatingLabel[];
  canEdit: boolean;
  onRename: (score: number, v: string) => void;
  onAdd: () => void;
  onRemove: (score: number) => void;
  onPreset: (n: number) => void;
  onSystem: () => void;
  /** The form uses the system's names (and descriptions). */
  usingSystem: boolean;
}) {
  return (
    <Card className="gap-3 rounded-[20px] p-4" aria-label="ระดับคะแนน">
      <div className="flex items-center gap-2">
        <h2 className="gv-bar-heading flex items-center gap-2 text-sm font-semibold">ระดับคะแนน</h2>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          1–{labels.length}
        </span>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-1.5">
          {[3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPreset(n)}
              className="border-border min-h-8 rounded-full border-[1.5px] px-3 text-xs font-semibold hover:border-ring"
            >
              ชุด {n} ระดับ
            </button>
          ))}
          <button
            type="button"
            aria-pressed={usingSystem}
            onClick={onSystem}
            className={cn(
              "min-h-8 rounded-full border-[1.5px] px-3 text-xs font-semibold hover:border-ring",
              usingSystem ? "border-primary bg-accent text-accent-foreground" : "border-border",
            )}
          >
            ชื่อเดิมของระบบ
          </button>
        </div>
      )}
      {usingSystem && (
        <p className="text-muted-foreground text-xs">
          ใช้ชื่อเดิมของระบบ ผู้ประเมินเห็นคำอธิบายสั้นๆ ใต้แต่ละระดับด้วย
        </p>
      )}
      <ul className="space-y-1.5">
        {[...labels].reverse().map((l) => (
          <li key={l.score} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[11px] font-bold",
                scoreTone(l.score, labels.length),
              )}
            >
              {l.score}
            </span>
            <Input
              aria-label={`ชื่อระดับ ${l.score}`}
              value={l.label}
              maxLength={40}
              disabled={!canEdit}
              className="h-10"
              onChange={(e) => onRename(l.score, e.target.value)}
            />
            {canEdit && (
              <IconBtn
                label={`ลบระดับ ${l.score}`}
                danger
                disabled={labels.length <= MIN_LEVELS}
                onClick={() => onRemove(l.score)}
              >
                <Trash2 className="size-4" />
              </IconBtn>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <Button
          variant="outline"
          className="h-10 border-dashed text-primary"
          disabled={labels.length >= MAX_LEVELS}
          onClick={onAdd}
        >
          <Plus className="size-4" aria-hidden="true" /> เพิ่มระดับ
          {labels.length >= MAX_LEVELS ? " (ได้สูงสุด 5)" : ""}
        </Button>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        ใช้กับทุกหัวข้อในแบบนี้ · คะแนนคิดเป็น % จึงเทียบข้ามสเกลได้ ·
        แบบที่ยืนยันใช้แล้วเปลี่ยนไม่ได้ ต้องสร้างเวอร์ชันใหม่
      </p>
    </Card>
  );
}

/* ───────────────────────── phone preview ───────────────────────── */

function PhonePreview({
  flat,
  labels,
  custom,
  noteAtLowest,
  formName,
  sel,
}: {
  flat: { q: QuestionValues; s: Section }[];
  labels: RatingLabel[];
  custom: boolean;
  noteAtLowest: boolean;
  formName: string;
  sel: string | null;
}) {
  const [as, setAs] = useState<RaterType>("MANAGER");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<{ sel: string | null; i: number } | null>(null);
  const shown = flat.filter((x) => x.q.visibleTo.length === 0 || x.q.visibleTo.includes(as));
  // Follow the topic being edited (when this rater sees it) unless the arrows were used since.
  const followed = Math.max(
    0,
    shown.findIndex((x) => x.q.uiKey === sel),
  );
  const i = Math.min(
    manual && manual.sel === sel ? manual.i : followed,
    Math.max(0, shown.length - 1),
  );
  const x = shown[i];
  const rubric = rubricFor(labels.length, custom ? labels : null);
  const snap: SnapQuestion | null = x
    ? {
        id: x.q.uiKey,
        text: x.q.text || "(ยังไม่มีชื่อ)",
        helpText: x.q.helpText || null,
        answerType: x.q.answerType,
        options: CHOICE.has(x.q.answerType) ? x.q.options : null,
        weight: x.q.weight,
        required: x.q.required,
        visibleTo: x.q.visibleTo,
        section: x.s.name || null,
        levelDescriptions: Object.entries(x.q.levels)
          .filter(([, t]) => t.trim())
          .map(([score, text]) => ({ score: Number(score), text })),
      }
    : null;

  return (
    <Card className="gap-3 rounded-[20px] p-4" aria-label="ตัวอย่างที่ผู้ประเมินเห็น">
      <div className="flex items-center gap-2">
        <h2 className="gv-bar-heading flex items-center gap-2 text-sm font-semibold">
          ผู้ประเมินเห็นแบบนี้
        </h2>
        <div
          role="group"
          aria-label="ดูในมุมของ"
          className="bg-muted ml-auto flex gap-0.5 rounded-full p-0.5"
        >
          {(["MANAGER", "SELF", "PEER"] as RaterType[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={as === r}
              onClick={() => {
                setAs(r);
                setManual(null);
              }}
              className={cn(
                "min-h-8 rounded-full px-2.5 text-xs font-semibold",
                as === r && "bg-card shadow-sm",
              )}
            >
              {RATER_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[330px] rounded-[34px] bg-[var(--device-frame)] p-2 shadow-[0_24px_44px_-26px_rgba(11,59,56,0.6)]">
        <div className="bg-background h-[520px] [scrollbar-width:none] overflow-y-auto rounded-[27px]">
          <div className="sticky top-0 z-[1] bg-[linear-gradient(160deg,var(--on-hero-accent-fg),var(--primary))] px-3.5 pt-3 pb-2.5 text-white">
            <b className="block text-sm">ประเมิน วันชัย (ตัวอย่าง)</b>
            <span className="block truncate text-xs text-white/75">
              {formName} · ในฐานะ{RATER_LABEL[as]}
            </span>
            <div className="mt-2 flex gap-[3px]" aria-hidden="true">
              {shown.map((s, k) => (
                <span
                  key={s.q.uiKey}
                  className="h-1 flex-1 rounded-full"
                  style={{ background: k === i ? "#fff" : "rgba(255,255,255,.2)" }}
                />
              ))}
            </div>
          </div>
          <div className="p-3 [&_h2]:text-base">
            {snap ? (
              <QuestionStep
                key={`${snap.id}-${as}`}
                q={snap}
                index={i}
                total={shown.length}
                rubric={rubric}
                ratingMax={labels.length}
                value={answers[snap.id]}
                note={notes[snap.id] ?? ""}
                noteRequired={
                  noteAtLowest && snap.answerType === "RATING" && answers[snap.id] === 1
                }
                disabled={false}
                onValue={(v) => setAnswers((a) => ({ ...a, [snap.id]: v }))}
                onNote={(t) => setNotes((n) => ({ ...n, [snap.id]: t }))}
              />
            ) : (
              <p className="text-muted-foreground p-6 text-center text-xs">
                ไม่มีหัวข้อสำหรับ{RATER_LABEL[as]}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          className="h-9"
          disabled={i <= 0}
          onClick={() => setManual({ sel, i: i - 1 })}
        >
          ‹ ข้อก่อน
        </Button>
        <Button
          variant="outline"
          className="h-9"
          disabled={i >= shown.length - 1}
          onClick={() => setManual({ sel, i: i + 1 })}
        >
          ข้อถัดไป ›
        </Button>
      </div>
    </Card>
  );
}

/* ───────────────────────── question bank ───────────────────────── */

function BankPicker({
  open,
  onOpenChange,
  ratingMax,
  usedTexts,
  canEdit,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ratingMax: number;
  usedTexts: Set<string>;
  canEdit: boolean;
  onPick: (b: BankItem) => void;
}) {
  const { data, isLoading, isError, refetch } = useQuestionBank(open);
  const remove = useRemoveBankItem();
  const [q, setQ] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<BankItem | null>(null);
  const items = data?.data ?? [];
  const sections = [...new Set(items.map((b) => b.section).filter((s): s is string => !!s))];
  const term = q.trim().toLowerCase();
  const shown = items.filter(
    (b) =>
      (!section || b.section === section) &&
      (!term || `${b.text} ${b.helpText ?? ""} ${b.section ?? ""}`.toLowerCase().includes(term)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-3 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>คลังหัวข้อ</DialogTitle>
          <DialogDescription>
            หัวข้อจากแบบที่ยืนยันใช้แล้ว กด “เพิ่ม” เพื่อใส่ในแบบนี้ (คัดลอกมา แก้ได้อิสระ)
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            aria-label="ค้นหาหัวข้อ"
            placeholder="ค้นหาหัวข้อ"
            className="h-11 pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {sections.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[null, ...sections].map((s) => (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={section === s}
                onClick={() => setSection(s)}
                className={cn(
                  "min-h-8 shrink-0 rounded-full border-[1.5px] px-3 text-xs font-semibold whitespace-nowrap",
                  section === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-border",
                )}
              >
                {s ?? "ทั้งหมด"}
              </button>
            ))}
          </div>
        )}
        <div className="-mx-1 max-h-[52vh] space-y-2 overflow-y-auto px-1">
          {isError && <ErrorState onRetry={() => refetch()} />}
          {isLoading && <TableLoadingState rows={3} />}
          {!isLoading && !isError && items.length === 0 && (
            <p className="border-border text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
              คลังยังว่าง · หัวข้อจะถูกเก็บเข้าคลังเองเมื่อกด “ยืนยันใช้แบบนี้”
            </p>
          )}
          {!isLoading && items.length > 0 && shown.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              ไม่พบหัวข้อที่ตรงกับคำค้น
            </p>
          )}
          {shown.map((b) => {
            const used = usedTexts.has(b.text.trim());
            const levels = b.levelDescriptions?.length ?? 0;
            return (
              <div
                key={b.id}
                className="border-border bg-card flex items-start gap-3 rounded-2xl border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-semibold break-words">{b.text}</p>
                  <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
                    {b.section && (
                      <span className="font-semibold text-primary">
                        {b.section}
                      </span>
                    )}
                    <span>{ANSWER_TYPE_LABEL[b.answerType]}</span>
                    {b.answerType === "RATING" && (
                      <span>
                        {levels ? `คำอธิบาย ${levels} ระดับ` : "ยังไม่มีคำอธิบาย"}
                        {levels > 0 &&
                          b.scaleMax !== ratingMax &&
                          ` (เขียนไว้สำหรับ ${b.scaleMax} ระดับ)`}
                      </span>
                    )}
                    <span>ใช้แล้ว {b.usedCount} แบบ</span>
                  </p>
                  {b.helpText && (
                    <p className="text-muted-foreground mt-1 text-xs">ดูจาก: {b.helpText}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      className="h-9"
                      variant={used ? "outline" : "default"}
                      disabled={used}
                      onClick={() => onPick(b)}
                    >
                      {used ? (
                        "มีในแบบแล้ว"
                      ) : (
                        <>
                          <Plus className="size-4" aria-hidden="true" /> เพิ่ม
                        </>
                      )}
                    </Button>
                    <IconBtn label="เอาออกจากคลัง" danger onClick={() => setToRemove(b)}>
                      <Trash2 className="size-4" />
                    </IconBtn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <ConfirmDialog
          open={!!toRemove}
          onOpenChange={(v) => !v && setToRemove(null)}
          title={`เอา “${toRemove?.text ?? ""}” ออกจากคลัง?`}
          description="แบบประเมินที่ใช้หัวข้อนี้อยู่แล้วไม่เปลี่ยน · ถ้ายืนยันใช้แบบที่มีหัวข้อนี้อีก จะกลับเข้าคลังเอง"
          confirmLabel="เอาออก"
          destructive
          loading={remove.isPending}
          onConfirm={async () => {
            if (!toRemove) return;
            try {
              await remove.mutateAsync(toRemove.id);
              toast.success("เอาออกจากคลังแล้ว");
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : "ทำรายการไม่สำเร็จ");
            }
            setToRemove(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
