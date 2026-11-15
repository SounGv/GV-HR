/**
 * Which menu group a page belongs to, and the tabs that group shows on top of every page in it (pure, no imports;
 * checked by `node --experimental-strip-types scripts/check-section-tabs.mjs`).
 *
 * The tabs are the sidebar's own entries for that group (nothing new is invented), so switching to a sibling page is one
 * click and the person never has to open the side menu. A tab a person has no permission for is left out, like the menu.
 */

export type BadgeKey = "pendingApprovals" | "pendingReviews" | "unreadNotifications";

export interface SourceItem {
  label: string;
  href: string;
  permission: string;
  badgeKey?: BadgeKey;
  featured?: boolean;
  opensAiPanel?: boolean;
  isLogout?: boolean;
}

export interface SourceGroup {
  label: string;
  items: readonly SourceItem[];
}

export interface Tab {
  label: string;
  href: string;
  badgeKey?: BadgeKey;
}

export interface Entry extends Tab {
  group: string;
  /** Only entries that can be a tab (not the AI panel, not log out). */
  tab: boolean;
}

/** The launcher group (home, calendar, notifications, help, AI): its pages are not siblings, so no tab row. */
export const LAUNCHER_GROUP = "ภาพรวม";

/** One sidebar entry that is really several pages: shown as one tab each, with their own permission. */
const EXPAND: Record<string, { label: string; href: string; permission: string }[]> = {
  "/appraisal": [
    { label: "ภาพรวม", href: "/appraisal", permission: "campaign:manage" },
    { label: "แบบประเมิน", href: "/appraisal/forms", permission: "campaign:manage" },
    { label: "รอบประเมิน", href: "/appraisal/rounds", permission: "campaign:manage" },
    { label: "KPI", href: "/appraisal/kpi", permission: "campaign:manage" },
    { label: "รอบอัตโนมัติ", href: "/appraisal/recurring", permission: "campaign:update" },
    { label: "ตั้งค่า", href: "/appraisal/settings", permission: "campaign:manage" },
  ],
};

/** Entries that point at one page with a different `?tab=` each become a single tab (the page has its own tabs). */
const MERGE: Record<string, string> = { "/organization": "แผนกและโครงสร้างองค์กร" };

export interface SearchLike {
  get(key: string): string | null;
}

/**
 * The href that best matches the current URL. A longer path outranks a shorter one it starts with ("/attendance/corrections"
 * over "/attendance"); a href with a query only matches when the URL carries the same values ("/reports?view=leave"), and
 * each matching key adds a point. Returns undefined when nothing matches.
 */
export function bestMatchHref(pathname: string, search: SearchLike, hrefs: readonly string[]): string | undefined {
  const scored: { href: string; score: number }[] = [];
  for (const href of hrefs) {
    const url = new URL(href, "http://x");
    const path = url.pathname;
    const query = [...url.searchParams.entries()];
    const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
    const queryMatches = query.every(([key, value]) => search.get(key) === value);
    if (pathMatches && queryMatches) scored.push({ href, score: path.length * 10 + query.length });
  }
  return scored.sort((a, b) => b.score - a.score)[0]?.href;
}

const pathOf = (href: string) => new URL(href, "http://x").pathname;

/** Every page the menu knows, with the group it sits in. `canSee` filters by permission. */
export function entriesOf(groups: readonly SourceGroup[], canSee: (permission: string) => boolean): Entry[] {
  const out: Entry[] = [];
  for (const g of groups) {
    const merged = new Set<string>();
    for (const item of g.items) {
      if (!canSee(item.permission)) continue;
      const expanded = EXPAND[item.href];
      if (expanded) {
        for (const e of expanded) if (canSee(e.permission)) out.push({ group: g.label, label: e.label, href: e.href, tab: true });
        continue;
      }
      const path = pathOf(item.href);
      const mergedLabel = MERGE[path];
      if (mergedLabel) {
        if (merged.has(path)) continue;
        merged.add(path);
        out.push({ group: g.label, label: mergedLabel, href: path, tab: true });
        continue;
      }
      out.push({
        group: g.label,
        label: item.label,
        href: item.href,
        badgeKey: item.badgeKey,
        tab: !item.opensAiPanel && !item.featured && !item.isLogout,
      });
    }
  }
  return out;
}

export interface Section {
  /** The group the page is in; undefined for a page outside the menu (profile, a coming-soon page). */
  group?: string;
  /** The menu name of this page, when the menu has one. */
  title?: string;
  tabs: Tab[];
  /** Which tab is the current page. */
  activeHref?: string;
}

export function resolveSection(groups: readonly SourceGroup[], canSee: (permission: string) => boolean, pathname: string, search: SearchLike): Section {
  const entries = entriesOf(groups, canSee);
  const href = bestMatchHref(pathname, search, entries.map((e) => e.href));
  const active = entries.find((e) => e.href === href);
  if (!active) return { tabs: [] };
  const tabs: Tab[] =
    active.group === LAUNCHER_GROUP
      ? []
      : entries.filter((e) => e.group === active.group && e.tab).map(({ label, href: h, badgeKey }) => ({ label, href: h, ...(badgeKey ? { badgeKey } : {}) }));
  return { group: active.group, title: active.label, tabs: tabs.length >= 2 ? tabs : [], activeHref: active.tab ? active.href : undefined };
}
