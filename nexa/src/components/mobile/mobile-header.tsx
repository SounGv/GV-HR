"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileHeaderProps {
  title: string;
  backHref?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function MobileHeader({ title, backHref, onBack, rightSlot, className }: MobileHeaderProps) {
  const showBack = Boolean(backHref || onBack);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-primary px-3 text-primary-foreground md:hidden",
        className,
      )}
    >
      {showBack ? (
        backHref ? (
          <Link
            href={backHref}
            aria-label="กลับ"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg transition active:bg-white/10"
          >
            <ChevronLeft className="size-6" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label="กลับ"
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg transition active:bg-white/10"
          >
            <ChevronLeft className="size-6" />
          </button>
        )
      ) : (
        <span className="size-9 shrink-0" />
      )}

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>

      <div className="flex shrink-0 items-center justify-end">{rightSlot ?? <span className="size-9" />}</div>
    </header>
  );
}
