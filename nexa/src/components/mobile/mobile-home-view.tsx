"use client";

import { useMobileMenuGroups } from "./use-mobile-menu-groups";
import { MobileMenuTileGrid } from "./mobile-menu-tile-grid";
import { MobileHeader } from "./mobile-header";

/**
 * Which tiles show up here is decided entirely by the permissions HR has
 * granted this account (via `can`) — there is no separate "employee view" /
 * "HR view" mode to switch between; a manager simply sees more sections
 * than an individual contributor because they hold more permissions.
 */
export function MobileHomeView({ title = "GV One" }: { title?: string }) {
  const { groups, hrStartIndex } = useMobileMenuGroups();

  return (
    <div className="gv-m gv-lg-bg flex min-h-full flex-col md:hidden">
      <MobileHeader title={title} backHref="/dashboard" />

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 pb-2">
        <MobileMenuTileGrid groups={groups} hrStartIndex={hrStartIndex} />
      </div>
    </div>
  );
}
