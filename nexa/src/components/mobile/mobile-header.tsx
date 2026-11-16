"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { RBell } from "@/components/shared/real-icons";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";
import { previousOf, readTrail } from "./nav-trail";

/** Pages that are a tab of the bottom bar: no back arrow (it led nowhere useful), and the bell sits in the header instead. */
export const MOBILE_TAB_ROOTS = new Set(["/dashboard", "/employees", "/requests", "/performance", "/profile", "/calendar", "/reports", "/appraisal/tasks"]);

/** The one place the unread count is shown on the phone (the profile tab no longer repeats it). */
export function MobileBell() {
  const { data } = useNotifications();
  const unread = data?.data.unread ?? 0;
  return (
    <Link href="/notifications" aria-label={unread > 0 ? `การแจ้งเตือน ยังไม่ได้อ่าน ${unread}` : "การแจ้งเตือน"} className="gv-lg relative flex size-11 items-center justify-center rounded-full transition active:scale-95">
      <RBell size={26} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1 text-xs font-semibold text-badge-foreground ring-2 ring-card">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

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
  const isTabRoot = MOBILE_TAB_ROOTS.has(usePathname());
  const showBack = (!!backHref || !!onBack) && !isTabRoot;
  const right = trailing ?? (isTabRoot ? <MobileBell /> : null);

  return (
    <header
      className={cn(
        "gv-lg-top sticky top-[env(safe-area-inset-top)] z-30 flex min-h-[60px] shrink-0 items-center gap-2.5 px-3.5 py-2 md:hidden",
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
            className="flex size-11 shrink-0 items-center justify-center rounded-full gv-lg text-foreground transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label="ย้อนกลับ"
            onClick={onBack}
            className="flex size-11 shrink-0 items-center justify-center rounded-full gv-lg text-foreground transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
        ))}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-foreground">{title}</h1>
      {right && <div className="shrink-0 text-foreground">{right}</div>}
    </header>
  );
}
