"use client";

import Link from "next/link";
import type { MobileMenuGroup } from "@/config/mobile-menu";

/**
 * Shared quick-menu tile grid — used by both the Home tab and "บริการ"
 * (/services), so a design change here is a design change everywhere this
 * pattern appears. Icons are filled tinted chips (not bare outline circles)
 * so they read as grounded, tappable buttons instead of floating outlines.
 */
export function MobileMenuTileGrid({ groups }: { groups: MobileMenuGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold text-foreground">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-primary" />
            {group.title}
          </h2>
          <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/60">
            <div className="grid grid-cols-4 gap-x-1 gap-y-4">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex flex-col items-center gap-2 rounded-xl px-0.5 py-1 text-center transition active:scale-95 active:bg-muted"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <item.icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
