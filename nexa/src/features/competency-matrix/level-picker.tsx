"use client";

import { cn } from "@/lib/utils";

const LEVELS = [0, 1, 2, 3, 4, 5];

/** 0 = "ไม่บังคับ" (not required / no assessment), 1-5 = proficiency level. */
export function LevelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg text-xs font-bold transition",
            value === l
              ? l === 0
                ? "bg-muted-foreground/20 text-foreground"
                : "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/10",
          )}
        >
          {l === 0 ? "–" : l}
        </button>
      ))}
    </div>
  );
}
