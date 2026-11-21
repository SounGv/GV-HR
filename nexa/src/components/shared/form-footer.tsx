"use client";

import { PageActions } from "@/components/layout/page-chrome";
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
 * Save buttons for full-page create/edit screens. The buttons submit the form via `form={formId}`; each records its intent through
 * `onClick` so the page can branch (return to list / stay / create another) after a successful save.
 *
 * On a computer the buttons sit in the title row at the right (as Favpo's do), drawn there by PageActions. On a phone they are a bar
 * fixed just above the tab bar, with the primary action in its own full-width spot.
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
  const secondary = actions.filter((a) => !a.primary);
  const primary = actions.filter((a) => a.primary);
  return (
    <>
      <PageActions>
        <div className="hidden items-center gap-2 md:flex">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          {secondary.map((a) => (
            <Button key={a.label} type="submit" form={formId} variant="outline" onClick={a.onClick} disabled={pending}>
              {a.label}
            </Button>
          ))}
          {primary.map((a) => (
            <Button key={a.label} type="submit" form={formId} variant="default" onClick={a.onClick} disabled={pending}>
              {pending && <Spinner />}
              {a.label}
            </Button>
          ))}
        </div>
      </PageActions>

      {/* The bar is fixed, so it takes no room in the page: this spacer lets the last field scroll clear of it and of the tab bar. */}
      <div aria-hidden="true" className="h-44 shrink-0 md:hidden" />
      <div
        className={cn(
          // `fixed` (not sticky) on a phone: on a short form a sticky bar inside the stretched scroll area would sit mid-screen with a
          // dead gap below it. It is pinned just above the tab bar (`--gv-tabbar` + safe-area). Hidden on a computer.
          "gv-foot border-border bg-card fixed inset-x-0 bottom-[calc(var(--gv-tabbar)+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-2 border-t px-4 py-2 md:hidden",
          className,
        )}
      >
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} className="flex-1">
            {cancelLabel}
          </Button>
          {secondary.map((a) => (
            <Button key={a.label} type="submit" form={formId} variant="outline" onClick={a.onClick} disabled={pending} className="flex-1">
              {a.label}
            </Button>
          ))}
        </div>
        {primary.map((a) => (
          <Button key={a.label} type="submit" form={formId} variant="default" onClick={a.onClick} disabled={pending} className="min-w-[10rem] flex-1">
            {pending && <Spinner />}
            {a.label}
          </Button>
        ))}
      </div>
    </>
  );
}
