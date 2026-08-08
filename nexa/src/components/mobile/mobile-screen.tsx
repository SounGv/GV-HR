"use client";

import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

export function MobileScreen({
  title,
  backHref,
  onBack,
  headerTrailing,
  footer,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  backHref?: string;
  onBack?: () => void;
  headerTrailing?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("flex min-h-full flex-col bg-muted md:hidden", className)}>
      <MobileHeader title={title} backHref={backHref} onBack={onBack} trailing={headerTrailing} />
      <div className={cn("flex-1 overflow-y-auto", contentClassName)}>{children}</div>
      {footer}
    </div>
  );
}

/** Desktop-only wrapper — hides mobile screen on md+ */
export function MobileOnly({ children }: { children: React.ReactNode }) {
  return <div className="md:hidden">{children}</div>;
}

/** Desktop-only wrapper — hides below md */
export function DesktopOnly({ children }: { children: React.ReactNode }) {
  return <div className="hidden md:block">{children}</div>;
}
