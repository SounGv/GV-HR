"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TemplateQuestion, TemplateSection, TemplateVisibleToType } from "./types";

/**
 * Renders a template's sections/questions two ways with the same markup:
 * "preview" (HR checking the form before activating it, inputs disabled —
 * always shows every question, regardless of `visibleTo`, since HR needs to
 * see the whole structure) and "answer" (a rater actually filling it in —
 * filtered to only the questions targeting their rater type, or unrestricted
 * ones). Kept in one component so the preview HR sees is pixel-identical to
 * what raters will fill out, modulo that visibility filter.
 */
export function TemplateFormRenderer({
  sections,
  mode,
  answers,
  onChange,
  viewerRaterType,
}: {
  sections: TemplateSection[];
  mode: "preview" | "answer";
  answers?: Record<string, string>;
  onChange?: (questionId: string, value: string) => void;
  viewerRaterType?: TemplateVisibleToType;
}) {
  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีหมวด/คำถามในแบบประเมินนี้</p>;
  }

  const visibleSections =
    mode === "answer"
      ? sections
          .map((s) => ({
            ...s,
            questions: s.questions.filter((q) => q.visibleTo.length === 0 || (!!viewerRaterType && q.visibleTo.includes(viewerRaterType))),
          }))
          .filter((s) => s.questions.length > 0)
      : sections;

  return (
    <div className="space-y-6">
      {visibleSections.map((section) => (
        <div key={section.id} className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">{section.name}</h3>
          <div className="space-y-3">
            {section.questions.map((q) => (
              <div key={q.id} className="space-y-2 rounded-xl border border-border p-3.5">
                <p className="text-base font-semibold text-foreground">
                  {q.text}
                  {q.required && <span className="ml-1 text-destructive">*</span>}
                </p>
                {q.helpText && <p className="text-sm text-muted-foreground">{q.helpText}</p>}
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
    <div className="space-y-2">
      {(question.options ?? []).map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-base font-medium transition",
            value === opt.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-muted",
            disabled && "cursor-default opacity-70",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              value === opt.value ? "bg-primary-foreground/20" : "bg-muted-foreground/10 text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
