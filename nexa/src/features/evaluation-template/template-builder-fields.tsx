"use client";

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BankQuestionPicker } from "./bank-question-picker";
import { TemplateFormRenderer } from "./template-renderer";
import { defaultOptionsFor } from "./question-defaults";
import type { AnswerType, QuestionFormValues, SectionFormValues, TemplateOption, TemplateSection, TemplateVisibleToType } from "./types";

export const ANSWER_TYPE_LABEL: Record<AnswerType, string> = {
  NUMERIC: "คะแนนตัวเลข",
  LETTER: "ตัวอักษร",
  CHOICE: "ตัวเลือก",
  YES_NO: "ใช่ / ไม่ใช่",
  LONG_TEXT: "ข้อความยาว",
  SHORT_TEXT: "ข้อความสั้น",
  FILE_EVIDENCE: "แนบไฟล์หลักฐาน",
};

export const NON_SCORING_TYPES = new Set<AnswerType>(["LONG_TEXT", "SHORT_TEXT", "FILE_EVIDENCE"]);

export function emptyQuestion(order: number): QuestionFormValues {
  return {
    uiKey: crypto.randomUUID(),
    text: "",
    helpText: "",
    answerType: "CHOICE",
    options: defaultOptionsFor("CHOICE"),
    weight: 1,
    required: true,
    order,
    visibleTo: [],
  };
}

export function emptySection(order: number): SectionFormValues {
  return { name: "", order, questions: [emptyQuestion(0)] };
}

/** Draft sections -> the shape TemplateFormRenderer expects for a live
 * preview — shared by the builder's own inline preview panel, the standalone
 * Template page, and the campaign wizard's preview step, so there's one
 * conversion instead of three near-identical copies. Placeholder ids are
 * fine (never sent anywhere) since this only ever feeds a read-only render. */
export function toRendererSections(sections: SectionFormValues[]): TemplateSection[] {
  return sections.map((s, si) => ({
    id: `preview-section-${si}`,
    name: s.name || "(ยังไม่มีชื่อหมวด)",
    order: si,
    questions: s.questions.map((q, qi) => ({
      id: `preview-question-${si}-${qi}`,
      text: q.text || "(ยังไม่มีคำถาม)",
      helpText: q.helpText ?? null,
      answerType: q.answerType,
      options: q.options ?? null,
      weight: q.weight,
      required: q.required,
      order: qi,
      visibleTo: q.visibleTo,
      competencyId: q.competencyId ?? null,
    })),
  }));
}

/** Quick-start scaffolds for a brand-new (empty) draft — pure local
 * convenience, not tied to any saved EvaluationTemplate/Competency row.
 * Only offered while the draft is still essentially blank (see
 * TopicsAndQuestionsBuilder's `isBlankDraft`), same guard the reference
 * mockup used, so applying one never silently discards real work. */
function buildQuickStartSection(name: string, questions: { text: string; weight: number; type: "rating" | "text" }[]): SectionFormValues {
  return {
    name,
    order: 0,
    questions: questions.map((q, qi) => {
      const answerType: AnswerType = q.type === "rating" ? "NUMERIC" : "LONG_TEXT";
      return {
        uiKey: crypto.randomUUID(),
        text: q.text,
        helpText: "",
        answerType,
        options: defaultOptionsFor(answerType),
        weight: q.weight,
        required: true,
        order: qi,
        visibleTo: [],
      };
    }),
  };
}

const QUICK_START_TEMPLATES: { id: string; name: string; description: string; build: () => SectionFormValues[] }[] = [
  {
    id: "360-standard",
    name: "360 องศามาตรฐาน",
    description: "4 หมวดหลักที่ใช้ประเมินแบบรอบด้าน",
    build: () => [
      buildQuickStartSection("ผลงานและความรับผิดชอบ", [
        { text: "ส่งมอบงานตรงเวลาตามที่ตกลงไว้", weight: 20, type: "rating" },
        { text: "รับผิดชอบต่อผลลัพธ์ของงานที่ทำ", weight: 15, type: "rating" },
      ]),
      buildQuickStartSection("การทำงานร่วมกับผู้อื่น", [
        { text: "สื่อสารกับทีมอย่างชัดเจน", weight: 15, type: "rating" },
        { text: "ช่วยเหลือเพื่อนร่วมทีมเมื่อจำเป็น", weight: 10, type: "rating" },
      ]),
      buildQuickStartSection("การแก้ปัญหาและความคิดริเริ่ม", [
        { text: "เสนอทางแก้เมื่อเจอปัญหาโดยไม่ต้องรอสั่งการ", weight: 20, type: "rating" },
      ]),
      buildQuickStartSection("การพัฒนาตนเอง", [
        { text: "เรียนรู้ทักษะใหม่และนำมาปรับใช้กับงานจริง", weight: 20, type: "rating" },
      ]),
    ],
  },
  {
    id: "manager-review",
    name: "ประเมินหัวหน้างาน",
    description: "เน้นทักษะการบริหารทีมและการตัดสินใจ",
    build: () => [
      buildQuickStartSection("การบริหารทีม", [
        { text: "มอบหมายงานเหมาะสมกับความสามารถของแต่ละคน", weight: 35, type: "rating" },
        { text: "ให้ feedback ที่นำไปปรับปรุงได้จริง", weight: 35, type: "rating" },
      ]),
      buildQuickStartSection("การตัดสินใจ", [{ text: "ตัดสินใจได้ทันเวลาเมื่อทีมต้องการทิศทาง", weight: 30, type: "rating" }]),
      buildQuickStartSection("ความคิดเห็นเปิดกว้าง", [
        { text: "มีอะไรอยากให้หัวหน้าปรับปรุงเพิ่มเติมหรือไม่", weight: 0, type: "text" },
      ]),
    ],
  },
];

function OptionsEditor({
  answerType,
  options,
  onChange,
}: {
  answerType: AnswerType;
  options: TemplateOption[];
  onChange: (options: TemplateOption[]) => void;
}) {
  if (NON_SCORING_TYPES.has(answerType)) return null;

  if (answerType === "NUMERIC") {
    const min = options[0] ? Number(options[0].value) : 1;
    const max = options[options.length - 1] ? Number(options[options.length - 1].value) : 5;
    function setRange(nextMin: number, nextMax: number) {
      if (!Number.isFinite(nextMin) || !Number.isFinite(nextMax)) return;
      if (nextMin >= nextMax || nextMax - nextMin > 20) return;
      const next: TemplateOption[] = [];
      for (let n = nextMin; n <= nextMax; n++) next.push({ value: String(n), label: String(n), score: n });
      onChange(next);
    }
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>สเกลคะแนน</span>
        <Input
          type="number"
          className="h-8 w-16"
          value={min}
          onChange={(e) => setRange(Number(e.target.value), max)}
        />
        <span>ถึง</span>
        <Input
          type="number"
          className="h-8 w-16"
          value={max}
          onChange={(e) => setRange(min, Number(e.target.value))}
        />
      </div>
    );
  }

  if (answerType === "YES_NO") {
    const yes = options.find((o) => o.value === "YES") ?? { value: "YES", label: "ใช่", score: 1 };
    const no = options.find((o) => o.value === "NO") ?? { value: "NO", label: "ไม่ใช่", score: 0 };
    return (
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{yes.label}</span> =
          <Input
            type="number"
            className="h-8 w-16"
            value={yes.score}
            onChange={(e) => onChange([{ ...yes, score: Number(e.target.value) || 0 }, no])}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-foreground">{no.label}</span> =
          <Input
            type="number"
            className="h-8 w-16"
            value={no.score}
            onChange={(e) => onChange([yes, { ...no, score: Number(e.target.value) || 0 }])}
          />
        </div>
      </div>
    );
  }

  // LETTER / CHOICE — HR-defined option rows: label + meaning + score.
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="h-8 flex-1"
            placeholder={answerType === "LETTER" ? "เช่น A" : "เช่น ดี"}
            value={opt.label}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, label: e.target.value, value: e.target.value };
              onChange(next);
            }}
          />
          <Input
            type="number"
            className="h-8 w-20"
            placeholder="คะแนน"
            value={opt.score}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, score: Number(e.target.value) || 0 };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, { value: "", label: "", score: 0 }])}
      >
        <Plus className="size-3.5" /> เพิ่มตัวเลือก
      </Button>
    </div>
  );
}

const VISIBLE_TO_OPTIONS: { value: TemplateVisibleToType; label: string }[] = [
  { value: "SELF", label: "ตนเอง" },
  { value: "MANAGER", label: "หัวหน้างาน" },
  { value: "PEER", label: "เพื่อนร่วมงาน" },
  { value: "UPWARD", label: "ลูกน้อง" },
  { value: "HR_EXEC", label: "HR/ผู้บริหาร" },
];

/** Whether this question already has anything set in its "advanced" fields —
 * used so a question loaded with real helpText/visibleTo (e.g. from the bank
 * picker, or an already-saved template) opens with details expanded instead
 * of hiding data the HR user already entered. */
function hasAdvancedContent(question: QuestionFormValues): boolean {
  return !!question.helpText?.trim() || question.visibleTo.length > 0;
}

export function QuestionEditor({
  question,
  onChange,
  onRemove,
  dragHandleProps,
}: {
  question: QuestionFormValues;
  onChange: (question: QuestionFormValues) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [showDetails, setShowDetails] = useState(() => hasAdvancedContent(question));

  function setAnswerType(type: AnswerType) {
    onChange({ ...question, answerType: type, options: defaultOptionsFor(type) });
  }

  function toggleVisibleTo(type: TemplateVisibleToType) {
    const next = question.visibleTo.includes(type)
      ? question.visibleTo.filter((t) => t !== type)
      : [...question.visibleTo, type];
    onChange({ ...question, visibleTo: next });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1.5 flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          aria-label="ลากเพื่อจัดลำดับ"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </button>
        <Textarea
          rows={1}
          className="min-h-9 flex-1 resize-none"
          placeholder="ข้อคำถาม"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
        />
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onRemove} aria-label="ลบข้อคำถาม">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>

      {/* Primary fields only — the ones every question needs. Help text,
       * answer options, and rater visibility are secondary/occasional, so
       * they're tucked behind "รายละเอียดเพิ่มเติม" instead of always taking
       * up a full row each — a template with 15 questions used to mean 15
       * fully-expanded option editors on screen at once. */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={question.answerType} onValueChange={(v) => setAnswerType(v as AnswerType)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ANSWER_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          น้ำหนัก (%)
          <Input
            type="number"
            min={1}
            max={100}
            className="h-8 w-16"
            disabled={NON_SCORING_TYPES.has(question.answerType)}
            value={NON_SCORING_TYPES.has(question.answerType) ? 0 : question.weight}
            onChange={(e) => onChange({ ...question, weight: Number(e.target.value) || 1 })}
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={question.required} onCheckedChange={(v) => onChange({ ...question, required: !!v })} />
          บังคับตอบ
        </label>

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {showDetails ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          รายละเอียดเพิ่มเติม
        </button>
      </div>

      {showDetails && (
        <div className="space-y-2.5 border-t border-border pt-2.5">
          <Input
            className="h-8 text-xs"
            placeholder="คำอธิบาย/ตัวอย่างพฤติกรรม (ไม่บังคับ)"
            value={question.helpText ?? ""}
            onChange={(e) => onChange({ ...question, helpText: e.target.value })}
          />

          <OptionsEditor
            answerType={question.answerType}
            options={question.options ?? []}
            onChange={(options) => onChange({ ...question, options })}
          />

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">มองเห็นเฉพาะ (ไม่เลือก = ทุกคนเห็น)</p>
            <div className="flex flex-wrap gap-1.5">
              {VISIBLE_TO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleVisibleTo(opt.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    question.visibleTo.includes(opt.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OptionsEditor is hidden behind "รายละเอียดเพิ่มเติม" above, but a
       * scoring question always needs its options set (score-per-choice)
       * even if the HR user never opens the details panel — surface a
       * one-line reminder instead of silently accepting an empty options
       * list, which would make every answer score 0. */}
      {!showDetails &&
        !NON_SCORING_TYPES.has(question.answerType) &&
        (!question.options || question.options.length < 2 || question.options.some((o) => !o.label.trim())) && (
          <p className="text-xs text-warning">ยังไม่ได้ตั้งตัวเลือก/คะแนน — เปิด &quot;รายละเอียดเพิ่มเติม&quot; เพื่อกำหนด</p>
        )}
    </div>
  );
}

function DraggableQuestionItem({
  question,
  onChange,
  onRemove,
}: {
  question: QuestionFormValues;
  onChange: (question: QuestionFormValues) => void;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={question} dragListener={false} dragControls={dragControls}>
      <QuestionEditor
        question={question}
        onChange={onChange}
        onRemove={onRemove}
        dragHandleProps={{ onPointerDown: (e) => dragControls.start(e) }}
      />
    </Reorder.Item>
  );
}

/** Question list for exactly one section — no section-name field, since in
 * the staged builder below the name is set in the earlier "topics" stage. */
function SectionQuestionsPanel({
  section,
  onChange,
}: {
  section: SectionFormValues;
  onChange: (section: SectionFormValues) => void;
}) {
  function updateQuestion(qi: number, question: QuestionFormValues) {
    const questions = [...section.questions];
    questions[qi] = question;
    onChange({ ...section, questions });
  }

  function removeQuestion(qi: number) {
    onChange({ ...section, questions: section.questions.filter((_, i) => i !== qi) });
  }

  return (
    <div className="space-y-3">
      <Reorder.Group
        axis="y"
        values={section.questions}
        onReorder={(questions) => onChange({ ...section, questions })}
        className="space-y-2.5"
      >
        {section.questions.map((q, qi) => (
          <DraggableQuestionItem
            key={q.uiKey ?? qi}
            question={q}
            onChange={(question) => updateQuestion(qi, question)}
            onRemove={() => removeQuestion(qi)}
          />
        ))}
      </Reorder.Group>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...section, questions: [...section.questions, emptyQuestion(section.questions.length)] })}
        >
          <Plus className="size-3.5" /> เพิ่มข้อย่อย
        </Button>
        <BankQuestionPicker
          onAdd={(question) =>
            onChange({
              ...section,
              questions: [...section.questions, { ...question, uiKey: crypto.randomUUID(), order: section.questions.length }],
            })
          }
        />
      </div>
    </div>
  );
}

/** One category card — name + reorder/delete in the header, expand to edit
 * its questions inline (SectionQuestionsPanel) right there instead of a
 * separate step. A rolled-up weight badge is informational only: our model
 * weights each QUESTION, not the category, so this is just the sum of the
 * category's own question weights, not a separately-editable number. */
function AccordionCategoryCard({
  section,
  isOpen,
  onToggle,
  onChange,
  onRemove,
}: {
  section: SectionFormValues;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (section: SectionFormValues) => void;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();
  const categoryWeight = section.questions
    .filter((q) => !NON_SCORING_TYPES.has(q.answerType))
    .reduce((sum, q) => sum + (q.weight || 0), 0);

  return (
    <Reorder.Item value={section} dragListener={false} dragControls={dragControls}>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            className="flex size-7 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
            aria-label="ลากเพื่อจัดลำดับหมวด"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <GripVertical className="size-4" />
          </button>
          <Input
            className="flex-1 font-medium"
            placeholder="ชื่อหมวด เช่น ผลการปฏิบัติงาน"
            value={section.name}
            onChange={(e) => onChange({ ...section, name: e.target.value })}
          />
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {section.questions.length} ข้อ{categoryWeight > 0 ? ` · ${categoryWeight}%` : ""}
          </span>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onToggle} aria-label={isOpen ? "ยุบหมวด" : "ขยายหมวด"}>
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onRemove} aria-label="ลบหมวด">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
        {isOpen && (
          <div className="border-t border-border p-3 pt-3">
            <SectionQuestionsPanel section={section} onChange={onChange} />
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

/** "หมวด/ข้อย่อย" builder — shared by the standalone Template builder page and
 * the campaign wizard's questions step so both stay in sync. One page: every
 * category is a collapsible card (its questions live inline once expanded,
 * not a separate step) with a live preview alongside showing exactly what a
 * rater will see, plus quick-start scaffolds for a brand-new draft. */
export function TopicsAndQuestionsBuilder({
  sections,
  onChange,
}: {
  sections: SectionFormValues[];
  onChange: (sections: SectionFormValues[]) => void;
}) {
  const [openId, setOpenId] = useState(0);
  const [pendingQuickStart, setPendingQuickStart] = useState<string | null>(null);

  function updateSection(i: number, section: SectionFormValues) {
    const next = [...sections];
    next[i] = section;
    onChange(next);
  }

  function removeSection(i: number) {
    onChange(sections.filter((_, idx) => idx !== i));
  }

  const totalWeight = sections
    .flatMap((s) => s.questions)
    .filter((q) => !NON_SCORING_TYPES.has(q.answerType))
    .reduce((sum, q) => sum + (q.weight || 0), 0);
  const weightOk = totalWeight === 100;

  // Quick-start scaffolds only make sense against a still-blank draft — same
  // guard the reference design used, so picking one never silently discards
  // real work HR already typed in.
  const isBlankDraft =
    sections.length <= 1 &&
    !(sections[0] && sections[0].name.trim()) &&
    (!sections[0] || sections[0].questions.every((q) => !q.text.trim()));

  function applyQuickStart(templateId: string) {
    const tpl = QUICK_START_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const built = tpl.build();
    onChange(built);
    setOpenId(0);
    setPendingQuickStart(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">เริ่มจากแม่แบบ</span>
        <div className="flex flex-wrap gap-2">
          {QUICK_START_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={tpl.description}
              onClick={() => (isBlankDraft ? applyQuickStart(tpl.id) : setPendingQuickStart(tpl.id))}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground/80 hover:bg-muted"
            >
              {tpl.name}
            </button>
          ))}
        </div>
        {pendingQuickStart && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2 text-sm text-warning">
            <span>ใช้แม่แบบนี้จะแทนที่หมวดและคำถามที่กรอกไว้อยู่ตอนนี้ทั้งหมด</span>
            <Button type="button" size="sm" onClick={() => applyQuickStart(pendingQuickStart)}>
              ยืนยันใช้แม่แบบ
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingQuickStart(null)}>
              ยกเลิก
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">หมวดหัวข้อประเมิน</span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                weightOk ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              รวมน้ำหนัก {totalWeight}% {weightOk ? "✓" : "— ต้องเท่ากับ 100%"}
            </span>
          </div>

          <Reorder.Group axis="y" values={sections} onReorder={onChange} className="space-y-3">
            {sections.map((s, i) => (
              <AccordionCategoryCard
                key={i}
                section={s}
                isOpen={openId === i}
                onToggle={() => setOpenId((prev) => (prev === i ? -1 : i))}
                onChange={(section) => updateSection(i, section)}
                onRemove={() => removeSection(i)}
              />
            ))}
          </Reorder.Group>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onChange([...sections, emptySection(sections.length)]);
              setOpenId(sections.length);
            }}
          >
            <Plus className="size-4" /> เพิ่มหมวด
          </Button>
        </div>

        <div className="lg:sticky lg:top-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ตัวอย่างหน้าจอผู้ประเมิน</span>
            <div className="mt-3">
              <TemplateFormRenderer sections={toRendererSections(sections)} mode="preview" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
