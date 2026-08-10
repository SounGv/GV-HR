"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnswerType, QuestionFormValues, SectionFormValues, TemplateOption } from "./types";

export const ANSWER_TYPE_LABEL: Record<AnswerType, string> = {
  NUMERIC: "คะแนนตัวเลข",
  LETTER: "ตัวอักษร",
  CHOICE: "ตัวเลือก",
  YES_NO: "ใช่ / ไม่ใช่",
  LONG_TEXT: "ข้อความยาว",
};

function defaultOptionsFor(type: AnswerType): TemplateOption[] | undefined {
  switch (type) {
    case "NUMERIC":
      return [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n), score: n }));
    case "YES_NO":
      return [
        { value: "YES", label: "ใช่", score: 1 },
        { value: "NO", label: "ไม่ใช่", score: 0 },
      ];
    case "LETTER":
      return [
        { value: "A", label: "A", score: 4 },
        { value: "B", label: "B", score: 3 },
        { value: "C", label: "C", score: 2 },
        { value: "D", label: "D", score: 1 },
      ];
    case "CHOICE":
      return [
        { value: "", label: "", score: 0 },
        { value: "", label: "", score: 0 },
      ];
    case "LONG_TEXT":
      return undefined;
  }
}

export function emptyQuestion(order: number): QuestionFormValues {
  return {
    text: "",
    helpText: "",
    answerType: "CHOICE",
    options: defaultOptionsFor("CHOICE"),
    weight: 1,
    required: true,
    order,
  };
}

export function emptySection(order: number): SectionFormValues {
  return { name: "", order, questions: [emptyQuestion(0)] };
}

function OptionsEditor({
  answerType,
  options,
  onChange,
}: {
  answerType: AnswerType;
  options: TemplateOption[];
  onChange: (options: TemplateOption[]) => void;
}) {
  if (answerType === "LONG_TEXT") return null;

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

export function QuestionEditor({
  question,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  question: QuestionFormValues;
  onChange: (question: QuestionFormValues) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  function setAnswerType(type: AnswerType) {
    onChange({ ...question, answerType: type, options: defaultOptionsFor(type) });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Textarea
          rows={1}
          className="min-h-9 flex-1 resize-none"
          placeholder="ข้อคำถาม"
          value={question.text}
          onChange={(e) => onChange({ ...question, text: e.target.value })}
        />
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={!canMoveUp} onClick={onMoveUp} aria-label="เลื่อนขึ้น">
            <ChevronUp className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={!canMoveDown} onClick={onMoveDown} aria-label="เลื่อนลง">
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onRemove} aria-label="ลบข้อคำถาม">
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>

      <Input
        className="h-8 text-xs"
        placeholder="คำอธิบาย/ตัวอย่างพฤติกรรม (ไม่บังคับ)"
        value={question.helpText ?? ""}
        onChange={(e) => onChange({ ...question, helpText: e.target.value })}
      />

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
          น้ำหนัก
          <Input
            type="number"
            min={1}
            max={10}
            className="h-8 w-16"
            value={question.weight}
            onChange={(e) => onChange({ ...question, weight: Number(e.target.value) || 1 })}
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={question.required} onCheckedChange={(v) => onChange({ ...question, required: !!v })} />
          บังคับตอบ
        </label>
      </div>

      <OptionsEditor
        answerType={question.answerType}
        options={question.options ?? []}
        onChange={(options) => onChange({ ...question, options })}
      />
    </div>
  );
}

export function SectionEditor({
  section,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  section: SectionFormValues;
  onChange: (section: SectionFormValues) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  function updateQuestion(qi: number, question: QuestionFormValues) {
    const questions = [...section.questions];
    questions[qi] = question;
    onChange({ ...section, questions });
  }

  function removeQuestion(qi: number) {
    onChange({ ...section, questions: section.questions.filter((_, i) => i !== qi) });
  }

  function moveQuestion(qi: number, dir: -1 | 1) {
    const questions = [...section.questions];
    const target = qi + dir;
    if (target < 0 || target >= questions.length) return;
    [questions[qi], questions[target]] = [questions[target], questions[qi]];
    onChange({ ...section, questions });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-start gap-2">
        <Input
          className="flex-1 font-medium"
          placeholder="ชื่อหมวด เช่น ผลการปฏิบัติงาน"
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
        />
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={!canMoveUp} onClick={onMoveUp} aria-label="เลื่อนหมวดขึ้น">
            <ChevronUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={!canMoveDown} onClick={onMoveDown} aria-label="เลื่อนหมวดลง">
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onRemove} aria-label="ลบหมวด">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="space-y-2.5">
        {section.questions.map((q, qi) => (
          <QuestionEditor
            key={qi}
            question={q}
            onChange={(question) => updateQuestion(qi, question)}
            onRemove={() => removeQuestion(qi)}
            onMoveUp={() => moveQuestion(qi, -1)}
            onMoveDown={() => moveQuestion(qi, 1)}
            canMoveUp={qi > 0}
            canMoveDown={qi < section.questions.length - 1}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...section, questions: [...section.questions, emptyQuestion(section.questions.length)] })}
      >
        <Plus className="size-3.5" /> เพิ่มข้อย่อย
      </Button>
    </div>
  );
}
