"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";

import { useMobileTabs } from "@/components/layout/mobile-bottom-nav";
import { useNotifications } from "@/features/notification/hooks";
import { cn } from "@/lib/utils";
import { previousOf, readTrail } from "./nav-trail";

/** The one place the unread count is shown on the phone (the profile tab no longer repeats it). */
export function MobileBell() {
  const { data } = useNotifications();
  const unread = data?.data.unread ?? 0;
  return (
    <Link href="/notifications" aria-label={unread > 0 ? `การแจ้งเตือน ยังไม่ได้อ่าน ${unread}` : "การแจ้งเตือน"} className="relative flex size-11 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95">
      <Bell className="size-6" aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1 text-xs font-semibold text-badge-foreground ring-2 ring-[#0d47a1]">
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
  // Every page that has somewhere to go back to shows the arrow, tab pages included (hiding it on tabs made menus feel like dead ends).
  // A page that is a tab of this account's bottom bar also carries the bell, since the profile tab no longer shows the unread count.
  const pathname = usePathname();
  const { visibleTabs } = useMobileTabs();
  const isTabRoot = pathname === "/dashboard" || visibleTabs.some((t) => t.href.split("?")[0] === pathname);
  const showBack = !!backHref || !!onBack;
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
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label="ย้อนกลับ"
            onClick={onBack}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            <ArrowLeft className="size-[18px]" />
          </button>
        ))}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-white">{title}</h1>
      {right && <div className="shrink-0 text-white">{right}</div>}
    </header>
  );
}
