"use client";

import { PageHeaderBar, type Crumb } from "./page-header-bar";
import { FormFooter, type FormFooterAction } from "./form-footer";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Standard full-page create/edit scaffold: sticky header + card body + sticky
 * footer. Modules render their `<Form>` (with matching `formId`) as children.
 * Replaces per-module create/edit modals with a consistent route-based page.
 *
 * The card is at most 768px wide, so a form of 448 to 672px (every module's own `max-w-*` inside it) sits in a card that
 * fits it instead of a card as wide as the screen. A form that really needs the width (a builder, a table of permissions)
 * passes `wide`.
 */
export function FormPageShell({
  breadcrumbs,
  backHref,
  title,
  description,
  status,
  formId,
  pending,
  onCancel,
  actions,
  wide = false,
  children,
}: {
  breadcrumbs?: Crumb[];
  backHref: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  formId: string;
  pending?: boolean;
  onCancel: () => void;
  actions: FormFooterAction[];
  /** Let the card use the full width of the page (builders, wide tables); the default is a card of at most 768px. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeaderBar
        breadcrumbs={breadcrumbs}
        backHref={backHref}
        title={title}
        description={description}
        status={status}
      />
      <Card className={cn("rounded-lg md:rounded-lg", !wide && "max-w-3xl")}>
        <CardContent className={cn("px-4 pt-0 md:px-6 md:pt-6", !wide && "gv-favpo-form")}>{children}</CardContent>
      </Card>
      <FormFooter formId={formId} pending={pending} onCancel={onCancel} actions={actions} />
    </div>
  );
}
