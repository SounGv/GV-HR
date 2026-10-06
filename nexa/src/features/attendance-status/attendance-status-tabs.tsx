import Link from "next/link";
import { cn } from "@/lib/utils";

export interface StatusTab {
  href: string;
  label: string;
  count: number;
  active: boolean;
}

/**
 * Tabs that are real links, so a tab opens in a new window, survives a reload
 * and works with the Back button. The chosen tab is a solid dark-teal pill with
 * white text; each shows its count.
 */
export function AttendanceStatusTabs({ tabs, label }: { tabs: StatusTab[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
            t.active
              ? "border-transparent bg-[var(--flip7-teal-dark)] text-white"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {t.label}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs tabular-nums",
              t.active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {t.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
