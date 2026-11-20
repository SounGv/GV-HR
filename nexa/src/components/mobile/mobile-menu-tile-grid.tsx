"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { NavIcon } from "@/components/shared/nav-icon";
import { navIconArt } from "@/config/nav-icon-art";
import type { MobileMenuGroup } from "@/config/mobile-menu";

/**
 * Shared quick-menu tile grid — used by both the Home tab and "บริการ"
 * (/services), so a design change here is a design change everywhere this
 * pattern appears. Icons are the same single-colour outline set as the side menu
 * (config/nav-icon-art.ts) in the brand blue; a link the set does not cover keeps its illustrated icon.
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
            <div className="mb-4 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
              <Users className="size-3.5" />
              สำหรับหัวหน้างาน / ฝ่ายบุคคล
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
          <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold text-foreground">
            {group.title}
          </h2>
          <div className="gv-lg-card p-3">
            <div className="grid grid-cols-4 gap-x-1 gap-y-4">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex flex-col items-center gap-2 rounded-md px-0.5 py-1 text-center transition active:scale-95 active:bg-muted"
                >
                  <span className="gv-lg-tile flex size-[58px] items-center justify-center rounded-md text-primary">
                    {navIconArt(item.href) ? <NavIcon href={item.href} className="size-7" /> : <item.icon size={40} />}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
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
