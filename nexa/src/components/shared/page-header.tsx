import { PageChromePublisher } from "@/components/layout/page-chrome";

/**
 * A page's title and main buttons. On a computer they are not drawn here: they go up into the band at the top of the
 * screen (components/layout/section-band.tsx), next to the group's tabs, so the page starts with its work. The
 * description is no longer shown (it repeated the menu name); phones have their own header.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Kept so existing callers compile; the header takes no space in the page any more. */
  className?: string;
}) {
  return <PageChromePublisher title={title} description={description} actions={actions} />;
}
