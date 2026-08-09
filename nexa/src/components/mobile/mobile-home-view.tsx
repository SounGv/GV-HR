"use client";

import Link from "next/link";
import { useMobileMenuGroups } from "./use-mobile-menu-groups";

/**
 * Which tiles show up here is decided entirely by the permissions HR has
 * granted this account (via `can`) — there is no separate "employee view" /
 * "HR view" mode to switch between; a manager simply sees more sections
 * than an individual contributor because they hold more permissions.
 */
export function MobileHomeView({ title = "GV One" }: { title?: string }) {
  const groups = useMobileMenuGroups();

  return (
    <div className="flex min-h-full flex-col bg-muted md:hidden">
      <div className="sticky top-0 z-30 bg-primary px-4 py-3">
        <h1 className="text-lg font-bold text-primary-foreground">{title}</h1>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-2">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2.5 px-1 text-xs font-semibold text-muted-foreground">{group.title}</h2>
            <div className="rounded-xl border border-border bg-card px-1.5 py-4">
              <div className="grid grid-cols-4 gap-x-1 gap-y-5">
                {group.items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex flex-col items-center gap-2 px-1 text-center transition active:scale-95"
                  >
                    <span className="flex size-[42px] items-center justify-center rounded-full border-[1.5px] border-primary bg-card text-primary">
                      <item.icon className="size-[19px]" strokeWidth={2} />
                    </span>
                    <span className="text-[11px] font-semibold leading-snug text-foreground">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
