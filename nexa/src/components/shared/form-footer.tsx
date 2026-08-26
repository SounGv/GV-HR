"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

export type FormFooterAction = {
  label: string;
  /** Fired on click, before the form submits — use it to record the save intent. */
  onClick?: () => void;
  primary?: boolean;
};

/**
 * Sticky form footer for full-page create/edit screens. The save buttons submit
 * the form via `form={formId}`; each records its intent through `onClick` so the
 * page can branch (return to list / stay / create another) after a successful save.
 */
export function FormFooter({
  formId,
  pending = false,
  onCancel,
  cancelLabel = "ยกเลิก",
  actions,
  className,
}: {
  formId: string;
  pending?: boolean;
  onCancel: () => void;
  cancelLabel?: string;
  actions: FormFooterAction[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        // md:pr-24 (not the plain md:px-6 the left side gets) leaves room in
        // case the AI chat panel (AiChatPanel — fixed bottom-6 right-6,
        // desktop-only, opened from the sidebar) is open at the same time,
        // so its z-50 panel never renders on top of the primary save button
        // here, which sits at z-20.
        "sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-3 md:-mx-6 md:bg-background/85 md:py-3 md:pr-24 md:pl-6 md:backdrop-blur-xl",
        className,
      )}
    >
      <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
        {cancelLabel}
      </Button>
      {actions.map((a) => (
        <Button
          key={a.label}
          type="submit"
          form={formId}
          variant={a.primary ? "default" : "outline"}
          onClick={a.onClick}
          disabled={pending}
        >
          {a.primary && pending && <Spinner />}
          {a.label}
        </Button>
      ))}
    </div>
  );
}
