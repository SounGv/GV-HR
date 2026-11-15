import { cn } from "@/lib/utils";
import { StickyBar } from "./sticky-bar";

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
    <StickyBar
      className={cn(
        "hidden flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex",
        // Pinned under the top bar. Padding is fixed (not added only when stuck) so the
        // bar never changes height mid-scroll; the -mx cancel main's md:p-6.
        "md:sticky md:top-16 md:z-20 md:-mx-6 md:border-b md:border-transparent md:px-6 md:py-1.5 md:[will-change:transform]",
        "md:data-[stuck]:border-border/70 md:data-[stuck]:bg-background",
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
    </StickyBar>
  );
}
