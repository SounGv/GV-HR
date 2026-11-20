import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/** The assistant's small mark in chat and panels: a blue square with a sparkle. น้องวีบอท the character lives only on the sidebar card. */
export function AiMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground", className)}>
      <Sparkles className="size-[58%]" />
    </span>
  );
}
