"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { MobileMenuGroup } from "@/config/mobile-menu";

/**
 * Shared quick-menu tile grid — used by both the Home tab and "บริการ"
 * (/services), so a design change here is a design change everywhere this
 * pattern appears. Every icon is fixed, full-color illustrated artwork
 * (gv-hr-menu-icons.md) — the white icon box (not just bare icons) is what
 * keeps icons with a white detail (paper, calendar) visible in both themes.
 *
 * `hrStartIndex` (from `useMobileMenuGroups`) draws a labeled divider right
 * before the manager/HR sections, so accounts with approval rights see
 * their personal quick-menu and their team-management tools as two
 * distinct zones instead of one long undifferentiated list — without
 * hiding or collapsing anything they already have permission to see.
 */
export function MobileMenuTileGrid({ groups, hrStartIndex }: { groups: MobileMenuGroup[]; hrStartIndex?: number }) {
  return (
    <>
      {groups.map((group, i) => (
        <section key={group.title}>
          {i === hrStartIndex && i > 0 && (
            <div className="mb-4 flex items-center gap-2 px-1 text-[11px] font-semibold text-muted-foreground">
              <Users className="size-3.5" />
              สำหรับหัวหน้างาน / ฝ่ายบุคคล
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold text-foreground">
            <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: group.accent }} />
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
                  <span className="flex size-[52px] items-center justify-center rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgb(19_21_22_/_0.06)] dark:bg-[#23262A] dark:shadow-none">
                    <item.icon size={36} />
                  </span>
                  <span className="line-clamp-2 text-[12.5px] font-semibold leading-tight text-foreground">
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
