"use client";

import { cn } from "@/lib/utils";

export function MobileModuleCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rounded-xl bg-card p-4", className)}>{children}</div>;
}
