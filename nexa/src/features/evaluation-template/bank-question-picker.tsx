"use client";

import { useState } from "react";
import { Search, Library } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, TableLoadingState } from "@/components/shared/states";
import { useCompetencies } from "@/features/competency/hooks";
import type { QuestionType, Competency } from "@/features/competency/types";
import { defaultOptionsFor } from "./question-defaults";
import type { AnswerType, QuestionFormValues } from "./types";

function questionTypeToAnswerType(qt: QuestionType): AnswerType {
  switch (qt) {
    case "RATING_1_TO_5":
    case "PERCENTAGE":
    case "NUMERIC_TARGET":
      return "NUMERIC";
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      return "CHOICE";
    case "YES_NO":
      return "YES_NO";
    case "SHORT_TEXT":
      return "SHORT_TEXT";
    case "LONG_TEXT":
      return "LONG_TEXT";
    case "FILE_EVIDENCE":
      return "FILE_EVIDENCE";
  }
}

/** Converts a picked Question Bank item into a fresh template question —
 * text/weight/required are copied so they can still be tweaked per-template
 * without mutating the shared bank entry (competencyId keeps the link for
 * "used in N templates" usage tracking). */
export function bankItemToQuestion(item: Competency, order: number): QuestionFormValues {
  const answerType = questionTypeToAnswerType(item.questionType);
  return {
    text: item.name,
    helpText: item.exampleBehavior ?? item.description ?? undefined,
    answerType,
    options: defaultOptionsFor(answerType),
    weight: item.defaultWeight,
    required: item.isRequired,
    order,
    visibleTo: [],
    competencyId: item.id,
  };
}

/**
 * "ดึงหัวข้อจากคลังคำถาม" — HR picks a reusable Question Bank item instead
 * of authoring a new question from scratch every cycle (the acceptance
 * criterion this whole overhaul is centered on). Reuses the same
 * useCompetencies search the Question Bank page itself uses.
 */
export function BankQuestionPicker({ onAdd }: { onAdd: (question: QuestionFormValues) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCompetencies({ search: search || undefined });
  const items = data?.data ?? [];

  function pick(item: Competency) {
    onAdd(bankItemToQuestion(item, 0));
    setOpen(false);
    setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Library className="size-3.5" /> จากคลังคำถาม
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ดึงหัวข้อจากคลังคำถาม</DialogTitle>
          <DialogDescription>เลือกหัวข้อที่มีอยู่แล้ว — ไม่ต้องสร้างใหม่ทุกครั้ง</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="ค้นหาหัวข้อ..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isLoading ? (
            <TableLoadingState rows={4} />
          ) : items.length === 0 ? (
            <EmptyState icon={Library} title="ไม่พบหัวข้อ" description="ลองค้นหาด้วยคำอื่น" />
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{item.name}</span>
                  {item.category && <span className="block truncate text-xs text-muted-foreground">{item.category.name}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">น้ำหนัก {item.defaultWeight}%</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
