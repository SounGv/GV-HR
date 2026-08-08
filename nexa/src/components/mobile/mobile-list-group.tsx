import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileListGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {title && (
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{title}</h2>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">{children}</div>
    </section>
  );
}

export function MobileListRow({
  label,
  value,
  href,
  onClick,
  destructive,
  showChevron = !!href,
  className,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  showChevron?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "min-w-0 flex-1 text-[15px]",
          destructive ? "font-semibold text-destructive" : "text-foreground",
        )}
      >
        {label}
      </span>
      {value && <span className="shrink-0 text-sm text-muted-foreground">{value}</span>}
      {showChevron && href && (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      )}
    </>
  );

  const rowClass = cn(
    "flex min-h-[52px] items-center gap-2 border-b border-border px-4 last:border-b-0 active:bg-surface-muted/80",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClass, "w-full text-left")}>
        {inner}
      </button>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}

export function MobileListAction({
  label,
  href,
  onClick,
  variant = "default",
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "destructive";
}) {
  const className = cn(
    "flex min-h-[52px] w-full items-center justify-center border-b border-border bg-card text-[15px] font-semibold last:border-b-0 active:bg-surface-muted/80",
    variant === "destructive" ? "text-destructive" : "text-primary",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}
