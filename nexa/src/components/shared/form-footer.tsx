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
        // Below md, this can't just be `sticky bottom-0`: on a route that
        // falls through to the generic mobile auto-shell (MobileContentWrapper),
        // this footer ends up inside a `flex-1 overflow-y-auto` container that's
        // stretched to fill the viewport (so MobileScreen's min-h-full works for
        // *tall* content) — for a short form, `sticky` then has no scroll
        // distance to travel and just sits in normal flow right after the
        // card, stranding it mid-screen with a dead gap below before the
        // persistent bottom tab bar. `fixed` anchors it to the real viewport
        // instead, pinned just above that tab bar (h-16 + safe-area).
        //
        // md:pr-24 (not the plain md:px-6 the left side gets) leaves room in
        // case the AI chat panel (AiChatPanel — fixed bottom-6 right-6,
        // desktop-only, opened from the sidebar) is open at the same time,
        // so its z-50 panel never renders on top of the primary save button
        // here, which sits at z-20.
        // Below md, buttons stack instead of the desktop's single right-
        // aligned row: a plain `justify-end` row shrunk to phone width left
        // the primary action no more prominent than Cancel and stranded ~80px
        // of dead space on the left of the bar. Cancel + secondary actions
        // form a small row on top; the primary action gets its own full-width
        // row at the very bottom, in the thumb-reachable spot — the same
        // pattern MobilePrimaryButton already uses elsewhere (e.g. leave).
        "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t border-border bg-card px-4 py-3 md:sticky md:inset-x-auto md:bottom-0 md:flex-row md:flex-wrap md:items-center md:justify-end md:-mx-6 md:bg-background md:py-3 md:pr-24 md:pl-6",
        className,
      )}
    >
      <div className="flex items-center gap-2 md:contents">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 md:flex-none"
        >
          {cancelLabel}
        </Button>
        {actions
          .filter((a) => !a.primary)
          .map((a) => (
            <Button
              key={a.label}
              type="submit"
              form={formId}
              variant="outline"
              onClick={a.onClick}
              disabled={pending}
              className="flex-1 md:flex-none"
            >
              {a.label}
            </Button>
          ))}
      </div>
      {actions
        .filter((a) => a.primary)
        .map((a) => (
          <Button
            key={a.label}
            type="submit"
            form={formId}
            variant="default"
            onClick={a.onClick}
            disabled={pending}
            className="w-full md:w-auto"
          >
            {pending && <Spinner />}
            {a.label}
          </Button>
        ))}
    </div>
  );
}
