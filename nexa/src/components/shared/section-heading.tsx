import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Section title with the teal bar in front (dashboard-v3-mock.html), an
 * optional one-line hint, and an optional action on the right (e.g. a
 * "ดูทั้งหมด →" link). Used on the dashboard, evaluation overview and org chart.
 */
export function SectionHeading({
  title,
  hint,
  action,
  className,
  as: Tag = "h2",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-3 gap-y-1", className)}>
      <Tag className="gv-bar-heading flex items-center gap-2.5 text-[17px] leading-snug font-semibold text-foreground">{title}</Tag>
      {hint && <p className="text-[12.5px] text-muted-foreground sm:pb-px">{hint}</p>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
