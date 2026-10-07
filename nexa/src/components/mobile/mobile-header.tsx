"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function MobileHeader({
  title,
  backHref,
  preferHistory,
  onBack,
  trailing,
  className,
}: {
  title: React.ReactNode;
  backHref?: string;
  /** Go back to the page the user actually came from; `backHref` is only the fallback when there is none (a page opened straight from a link). */
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
              if (preferHistory && window.history.length > 1) {
                e.preventDefault();
                router.back();
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
