"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import type { MobileMenuGroup, MobileMenuTone } from "@/config/mobile-menu";

// One color per section instead of every tile being identical lime — makes
// each group instantly recognizable at a glance instead of reading as one
// undifferentiated wall of tiles.
const TONE_CLASSES: Record<MobileMenuTone, string> = {
  primary: "bg-primary text-primary-foreground",
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-white",
};

/**
 * Shared quick-menu tile grid — used by both the Home tab and "บริการ"
 * (/services), so a design change here is a design change everywhere this
 * pattern appears. Icons are filled tinted chips (not bare outline circles)
 * so they read as grounded, tappable buttons instead of floating outlines.
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
      {groups.map((group, i) => {
        const toneClass = TONE_CLASSES[group.tone ?? "primary"];
        return (
          <section key={group.title}>
            {i === hrStartIndex && i > 0 && (
              <div className="mb-4 flex items-center gap-2 px-1 text-[11px] font-semibold text-muted-foreground">
                <Users className="size-3.5" />
                สำหรับหัวหน้างาน / ฝ่ายบุคคล
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold text-foreground">
              <span className={`h-3.5 w-1 shrink-0 rounded-full ${toneClass.split(" ")[0]}`} />
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
                    <span className={`flex size-11 items-center justify-center rounded-2xl ${toneClass}`}>
                      <item.icon className="size-5" strokeWidth={2.25} />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
