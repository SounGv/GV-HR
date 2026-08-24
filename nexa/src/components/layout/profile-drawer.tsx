"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  KeyRound,
  LogOut,
  ShieldCheck,
  Settings2,
  User,
  UserRound,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/auth-context";
import { useNotifications } from "@/features/notification/hooks";
import { fullName } from "@/lib/format";
import { STATUS_LABEL } from "@/features/employee/labels";
import type { EmployeeStatus } from "@/features/employee/types";
import { useProfileDrawer } from "./profile-drawer-context";

/**
 * Closes the drawer when the browser/Android back gesture fires, instead of
 * navigating the page away. We push one harmless history entry while the
 * drawer is open so back-button/back-gesture produces a `popstate` we can
 * intercept; if the drawer closes some other way (X, outside click, ESC),
 * the effect's cleanup pops that same entry so the history stack doesn't
 * grow by one every time someone opens the drawer.
 *
 * `skipPopRef` is the fix for a real bug: tapping a nav Link both closes
 * the drawer AND pushes a new history entry (the Link's own navigation) in
 * the same click. Those two `pushState`s race — if this cleanup's
 * `history.back()` fires after the Link's navigation already landed, it
 * steps back and silently undoes it, so the tap looks like it did nothing.
 * Callers set `skipPopRef.current = true` right before triggering a close
 * that's actually a navigation, so this cleanup knows to leave history alone.
 */
function useCloseOnBackButton(open: boolean, close: () => void, skipPopRef: React.RefObject<boolean>) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ profileDrawer: true }, "");
    pushedRef.current = true;

    function onPopState() {
      pushedRef.current = false;
      close();
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        pushedRef.current = false;
        if (skipPopRef.current) {
          skipPopRef.current = false;
        } else {
          window.history.back();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Swipe-right-to-dismiss on touch devices — the panel is anchored to the
 * right edge, so dragging further right is the natural "push it away" gesture.
 *
 * The touch listeners attach only to `handleRef` (the header, which has no
 * links/buttons in it) while the visual slide `transform` is applied to
 * `panelRef` (the whole drawer content) — so a tap on any nav item never
 * reaches a touch handler that could interfere with it at all, structurally,
 * not just via the drag threshold below. The threshold is a second layer of
 * defense in case swiping ever gets attached somewhere with interactive
 * content: it only commits to a drag once the finger has moved past a small
 * slop and the movement reads as horizontal rather than vertical scroll, so
 * a plain tap never mutates anything. */
function useSwipeToClose(onClose: () => void) {
  const handleRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const DRAG_THRESHOLD = 10;

  useEffect(() => {
    const handle = handleRef.current;
    const panel = panelRef.current;
    if (!handle || !panel) return;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0]!.clientX;
      startY = e.touches[0]!.clientY;
      dragging = false;
    }
    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0]!.clientX - startX;
      const dy = e.touches[0]!.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
        dragging = true;
        panel!.style.transition = "none";
      }
      panel!.style.transform = `translateX(${Math.max(0, dx)}px)`;
    }
    function onTouchEnd(e: TouchEvent) {
      if (!dragging) return;
      dragging = false;
      panel!.style.transition = "";
      panel!.style.transform = "";
      const endX = e.changedTouches[0]?.clientX ?? startX;
      if (endX - startX > 80) onClose();
    }

    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: true });
    handle.addEventListener("touchend", onTouchEnd);
    return () => {
      handle.removeEventListener("touchstart", onTouchStart);
      handle.removeEventListener("touchmove", onTouchMove);
      handle.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose]);

  return { handleRef, panelRef };
}

/**
 * The account drawer — opened from the mobile bottom nav's "โปรไฟล์" tab,
 * the mobile home header's profile icon, and the desktop topbar's avatar
 * button (all via `useProfileDrawer()`, one shared instance mounted in
 * `AppShell`). Deliberately NOT a navigation hub: it shows who's logged in
 * and a short account-settings list, not the full permission-filtered menu
 * grid (that already lives on Home / "บริการ" / the bottom nav itself).
 */
export function ProfileDrawer() {
  const { open, closeDrawer, setOpen } = useProfileDrawer();
  const { user, can, logout } = useAuth();
  const { data: notificationsData } = useNotifications();
  const unreadCount = notificationsData?.data.unread ?? 0;
  const canSeeHelp = can("employee:update");

  const skipPopRef = useRef(false);
  useCloseOnBackButton(open, closeDrawer, skipPopRef);
  const { handleRef, panelRef } = useSwipeToClose(closeDrawer);

  /** Every nav Link uses this instead of `closeDrawer` directly — see the
   * skipPopRef doc comment on useCloseOnBackButton for why. */
  function handleNavigate() {
    skipPopRef.current = true;
    closeDrawer();
  }

  const displayName = user.employee ? fullName(user.employee.firstName, user.employee.lastName) : user.email;
  const roleLabel = user.roles[0] ?? "ผู้ใช้งาน";
  const statusLabel = user.employee ? STATUS_LABEL[user.employee.status as EmployeeStatus] ?? user.employee.status : null;

  const items = [
    { href: "/profile", label: "ข้อมูลส่วนตัว", icon: User, show: true },
    { href: "/notifications", label: "การแจ้งเตือน", icon: Bell, show: true, badge: unreadCount },
    { href: "/profile#security", label: "ความปลอดภัย", icon: ShieldCheck, show: true },
    { href: "/profile#security", label: "เปลี่ยนรหัสผ่าน", icon: KeyRound, show: true },
    { href: "/help", label: "คู่มือการใช้งาน", icon: Settings2, show: canSeeHelp },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-[380px] gap-0 overflow-y-auto p-0 md:w-[400px] md:max-w-[420px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>โปรไฟล์</SheetTitle>
        </SheetHeader>

        <div ref={panelRef} className="flex h-full flex-col">
          <div ref={handleRef} className="border-b border-border bg-gv-pale-green/40 p-5 pt-8">
            <div className="flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-icon-chip-bg text-icon-chip-fg ring-2 ring-card">
                {user.employee?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.employee.avatarUrl} alt={displayName} className="size-full object-cover" />
                ) : (
                  <UserRound className="size-7" strokeWidth={2.5} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-foreground">{displayName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {user.employee?.position?.title ?? "—"}
                  {user.employee?.department?.name ? ` · ${user.employee.department.name}` : ""}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border">
                    {roleLabel}
                  </span>
                  {statusLabel && (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      {statusLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {items
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={handleNavigate}
                  aria-label={item.label}
                  className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 text-[17px] font-semibold text-foreground transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99] active:bg-muted"
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-icon-chip-bg text-icon-chip-fg shadow-sm ring-1 ring-border/60">
                    <item.icon className="size-[18px]" strokeWidth={2.5} />
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[9px] font-semibold text-badge-foreground ring-2 ring-card">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
          </nav>

          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => {
                closeDrawer();
                logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive-muted px-4 py-3 text-sm font-bold text-destructive active:scale-[0.99]"
            >
              <LogOut className="size-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
