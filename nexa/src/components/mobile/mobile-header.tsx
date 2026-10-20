"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { previousOf, readTrail } from "./nav-trail";

export function MobileHeader({
  title,
  backHref,
  onBack,
  trailing,
  className,
}: {
  title: React.ReactNode;
  backHref?: string;
  /** Kept for older callers; every back arrow now returns to the page the person came from (see nav-trail.ts). */
  preferHistory?: boolean;
  onBack?: () => void;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const showBack = !!backHref || !!onBack;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-card px-3 md:hidden",
        className,
      )}
    >
      {showBack &&
        (backHref ? (
          <Link
            href={backHref}
            aria-label="ย้อนกลับ"
            onClick={(e) => {
              // Back to the page the person came from inside the app; `backHref` only when this page was opened first.
              const previous = previousOf(readTrail());
              if (previous) {
                e.preventDefault();
                router.push(previous);
              }
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label="ย้อนกลับ"
            onClick={onBack}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
        ))}
      <h1 className="min-w-0 flex-1 truncate text-base font-bold text-foreground">{title}</h1>
      {trailing && <div className="shrink-0 text-foreground">{trailing}</div>}
    </header>
  );
}
