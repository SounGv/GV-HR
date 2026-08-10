"use client";

import { cn } from "@/lib/utils";

const SCORES = [1, 2, 3, 4, 5];

/** Big, thumb-sized 1–5 tap targets — used anywhere a rater picks a competency score. */
export function ScorePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="ให้คะแนน 1 ถึง 5">
      {SCORES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={Math.round(value) === s}
          onClick={() => onChange(s)}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold transition active:scale-95",
            Math.round(value) === s
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
