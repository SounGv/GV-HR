import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

/**
 * Sticky enterprise page header: breadcrumb · back · title · status · actions.
 * Pins directly under the 64px topbar. Full-bleed via negative margins that
 * cancel the `main` padding (p-4 / md:p-6). Use on detail/create/edit pages.
 */
export function PageHeaderBar({
  breadcrumbs,
  backHref,
  title,
  description,
  status,
  actions,
  sticky = true,
  className,
}: {
  breadcrumbs?: Crumb[];
  backHref?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 hidden border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl md:-mx-6 md:block md:px-6",
        sticky && "md:sticky md:top-16 md:z-20",
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="เส้นทางนำทาง"
          className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="transition hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          {backHref && (
            <Link
              href={backHref}
              aria-label="ย้อนกลับ"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading truncate text-xl font-bold text-foreground sm:text-2xl">
                {title}
              </h1>
              {status}
            </div>
            {description && (
              <p className="truncate text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
