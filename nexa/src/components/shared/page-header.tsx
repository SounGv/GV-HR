import { cn } from "@/lib/utils";

/** Consistent page title block with optional description + right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "hidden flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h1 className="font-heading text-[22px] leading-snug font-bold text-foreground">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
