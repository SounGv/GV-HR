"use client";

import { PageHeaderBar, type Crumb } from "./page-header-bar";
import { FormFooter, type FormFooterAction } from "./form-footer";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Standard full-page create/edit scaffold: sticky header + card body + sticky
 * footer. Modules render their `<Form>` (with matching `formId`) as children.
 * Replaces per-module create/edit modals with a consistent route-based page.
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
      <Card className="border-0 bg-transparent shadow-none md:border md:bg-card md:shadow-sm">
        <CardContent className="px-0 pt-0 md:px-6 md:pt-6">{children}</CardContent>
      </Card>
      <FormFooter formId={formId} pending={pending} onCancel={onCancel} actions={actions} />
    </div>
  );
}
