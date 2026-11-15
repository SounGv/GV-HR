"use client";

import { useEffect, useRef, useState } from "react";

/** Height of the topbar the page header pins under (h-16). */
const TOPBAR_PX = 64;

/**
 * Wrapper for a page's header bar that stays in view under the top bar.
 *
 * It does two jobs the CSS alone cannot:
 *  - publishes its height as `--gv-page-header-h`, so a tab row that also sticks
 *    can sit just below it instead of hiding behind it (see stickyTabsRow);
 *  - sets `data-stuck` while pinned, so the bar can be see-through at rest (the
 *    soft band behind the page shows) and opaque once content scrolls under it.
 */
export function StickyBar({
  className,
  publish = true,
  children,
}: {
  className?: string;
  /** false = not sticky (callers that opt out), so it must not reserve space for tabs. */
  publish?: boolean;
  children: React.ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !publish) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty("--gv-page-header-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    write();
    const ro = new ResizeObserver(write);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--gv-page-header-h");
    };
  }, [publish]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !publish || typeof IntersectionObserver === "undefined") return;
    // The sentinel is a 1px strip on the bar's top edge. Shrinking the root by the
    // topbar height means it stops "intersecting" exactly when the bar is pinned.
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: `-${TOPBAR_PX}px 0px 0px 0px`,
      threshold: 1,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [publish]);

  return (
    <div ref={barRef} data-stuck={stuck ? "" : undefined} className={className}>
      {children}
      <span ref={sentinelRef} aria-hidden className="pointer-events-none absolute inset-x-0 -top-px h-px" />
    </div>
  );
}
