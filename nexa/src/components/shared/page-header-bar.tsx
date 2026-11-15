import { PageChromePublisher, type Crumb } from "@/components/layout/page-chrome";

export type { Crumb };

/**
 * A detail or report page's path, title, status and main buttons. On a computer they are drawn in the band at the top of
 * the screen (components/layout/section-band.tsx), not in a bar of their own, so only one header ever sticks. The
 * description, which on these pages says what the page is about (employee code and leave type, an author), is drawn
 * after the title. The title is kept for printing, which the band is not part of.
 */
export function PageHeaderBar({
  breadcrumbs,
  title,
  description,
  status,
  actions,
}: {
  breadcrumbs?: Crumb[];
  /** Kept so existing callers compile; the band has the back button. */
  backHref?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  /** Kept so existing callers compile; there is one sticky band for every page now. */
  sticky?: boolean;
  className?: string;
}) {
  return (
    <PageChromePublisher
      title={title}
      description={typeof description === "string" ? description : undefined}
      subtitle={typeof description === "string" ? description : undefined}
      crumbs={breadcrumbs}
      status={status}
      actions={actions}
    />
  );
}
