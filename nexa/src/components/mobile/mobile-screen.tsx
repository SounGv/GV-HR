"use client";

import { cn } from "@/lib/utils";
import { MobileHeader, type MobileHeaderProps } from "./mobile-header";

export interface MobileScreenProps extends MobileHeaderProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  className?: string;
}

/** Full-height mobile shell: purple header + muted content area + optional footer. */
export function MobileScreen({
  children,
  footer,
  contentClassName,
  className,
  ...headerProps
}: MobileScreenProps) {
  return (
    <div className={cn("flex min-h-[calc(100dvh-4rem)] flex-col bg-muted md:hidden", className)}>
      <MobileHeader {...headerProps} />
      <div className={cn("flex-1 overflow-y-auto px-4 py-4", contentClassName)}>{children}</div>
      {footer}
    </div>
  );
}

/** Visible only below md breakpoint. */
export function MobileOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("md:hidden", className)}>{children}</div>;
}

/** Hidden below md breakpoint. */
export function DesktopOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("hidden md:block", className)}>{children}</div>;
}
