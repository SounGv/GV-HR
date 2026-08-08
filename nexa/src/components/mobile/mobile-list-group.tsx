"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileListGroupProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileListGroup({ title, children, className }: MobileListGroupProps) {
  return (
    <section className={cn("space-y-2", className)}>
      {title ? <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2> : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">{children}</div>
    </section>
  );
}

export interface MobileListRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  className?: string;
}

export function MobileListRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  trailing,
  destructive,
  className,
}: MobileListRowProps) {
  const content = (
    <>
      {Icon ? (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 text-left">
        <p className={cn("text-sm font-medium", destructive ? "text-destructive" : "text-foreground")}>{label}</p>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {trailing ?? (href || onClick ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null)}
    </>
  );

  const rowClass = cn(
    "flex w-full items-center gap-3 px-4 py-3.5 transition active:bg-muted/60",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

export interface MobileListActionProps {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  className?: string;
}

export function MobileListAction({ label, onClick, href, destructive, className }: MobileListActionProps) {
  const actionClass = cn(
    "block w-full px-4 py-3.5 text-center text-sm font-semibold transition active:bg-muted/60",
    destructive ? "text-destructive" : "text-primary",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={actionClass}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={actionClass}>
      {label}
    </button>
  );
}
