import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface QuickAccessItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Icon-tile shortcuts to the most frequently used pages — desktop equivalent
 * of the icon-grid quick-menu the mobile app already has, so common actions
 * don't require opening a sidebar submenu first. Icons render bare (no
 * tinted chip behind them) in the shared brand-green color, matching
 * mobile-menu-tile-grid.tsx's flatter, single-accent treatment. */
export function QuickAccessGrid({ items }: { items: QuickAccessItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">เมนูลัด</h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-center transition hover:border-primary/40 hover:bg-accent/40"
          >
            <span className="flex size-11 items-center justify-center text-icon-chip-fg">
              <item.icon className="size-8" strokeWidth={1.75} />
            </span>
            <span className="line-clamp-2 text-xs font-medium leading-tight text-foreground">{item.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
