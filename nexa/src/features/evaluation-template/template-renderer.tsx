"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TemplateQuestion, TemplateSection } from "./types";

/**
 * Renders a template's sections/questions two ways with the same markup:
 * "preview" (HR checking the form before activating it, inputs disabled) and
 * "answer" (a rater actually filling it in). Kept in one component so the
 * preview HR sees is pixel-identical to what raters will fill out.
 */
export function TemplateFormRenderer({
  sections,
  mode,
  answers,
  onChange,
}: {
  sections: TemplateSection[];
  mode: "preview" | "answer";
  answers?: Record<string, string>;
  onChange?: (questionId: string, value: string) => void;
}) {
  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีหมวด/คำถามในแบบประเมินนี้</p>;
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{section.name}</h3>
          <div className="space-y-3">
            {section.questions.map((q) => (
              <div key={q.id} className="space-y-1.5 rounded-xl border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  {q.text}
                  {q.required && <span className="ml-1 text-destructive">*</span>}
                </p>
                {q.helpText && <p className="text-xs text-muted-foreground">{q.helpText}</p>}
                <QuestionAnswerInput
                  question={q}
                  disabled={mode === "preview"}
                  value={answers?.[q.id] ?? ""}
                  onChange={(v) => onChange?.(q.id, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionAnswerInput({
  question,
  disabled,
  value,
  onChange,
}: {
  question: TemplateQuestion;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  if (question.answerType === "LONG_TEXT") {
    return (
      <Textarea
        rows={3}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="พิมพ์คำตอบ…"
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(question.options ?? []).map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
            value === opt.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
            disabled && "cursor-default opacity-70",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
