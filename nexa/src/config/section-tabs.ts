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
  /** The small heading the side menu puts above this item (settings group). Used to split a long tab row into sections. */
  section?: string;
}

export interface SourceGroup {
  label: string;
  items: readonly SourceItem[];
}

export interface Tab {
  label: string;
  href: string;
  badgeKey?: BadgeKey;
  /** Which section of a long tab row this tab belongs to (see `groupTabs`). */
  section?: string;
}

export interface Entry extends Tab {
  group: string;
  /** Only entries that can be a tab (not the AI panel, not log out). */
  tab: boolean;
}

/** The launcher group (home, calendar, notifications, help, AI): its pages are not siblings, so no tab row. */
export const LAUNCHER_GROUP = "ภาพรวม";

/** One sidebar entry that is really several pages: shown as one tab each, with their own permission. */
const EXPAND: Record<string, { label: string; href: string; permission: string; section?: string }[]> = {
  "/appraisal": [
    { label: "ภาพรวม", href: "/appraisal", permission: "campaign:manage", section: "จัดการประเมิน" },
    { label: "แบบประเมิน", href: "/appraisal/forms", permission: "campaign:manage", section: "จัดการประเมิน" },
    { label: "รอบประเมิน", href: "/appraisal/rounds", permission: "campaign:manage", section: "จัดการประเมิน" },
    { label: "KPI", href: "/appraisal/kpi", permission: "campaign:manage", section: "จัดการประเมิน" },
    { label: "รอบอัตโนมัติ", href: "/appraisal/recurring", permission: "campaign:update", section: "จัดการประเมิน" },
    { label: "ตั้งค่า", href: "/appraisal/settings", permission: "campaign:manage", section: "จัดการประเมิน" },
  ],
};

/** Sections for entries whose menu item carries no `section` of its own (the evaluation group). */
const SECTION_OF_HREF: Record<string, string> = {
  "/appraisal/tasks": "ของฉัน",
  "/appraisal/my-results": "ของฉัน",
  "/training": "พัฒนา",
};

/** A tab row longer than this is split into sections (a row of chips above the tabs). */
export const MAX_FLAT_TABS = 6;

/** Entries that point at one page with a different `?tab=` each become a single tab (the page has its own tabs). */
const MERGE: Record<string, string> = { "/organization": "แผนกและโครงสร้างองค์กร" };

export interface SearchLike {
  get(key: string): string | null;
}

/**
 * The href that best matches the current URL. A longer path outranks a shorter one it starts with ("/attendance/corrections"
 * over "/attendance"); a href with a query only matches when the URL carries the same values ("/reports?view=leave"), and
 * each matching key adds a point. When the page is opened without the query, the first entry with that exact path wins. Returns undefined when nothing matches.
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
  const best = scored.sort((a, b) => b.score - a.score)[0]?.href;
  if (best) return best;
  // The page opened without its query ("/requests"): the first entry that points at that exact page still names it.
  return hrefs.find((href) => new URL(href, "http://x").pathname === pathname);
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
        for (const e of expanded) if (canSee(e.permission)) out.push({ group: g.label, label: e.label, href: e.href, tab: true, ...(e.section ? { section: e.section } : {}) });
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
      const section = item.section ?? SECTION_OF_HREF[item.href];
      out.push({
        group: g.label,
        label: item.label,
        href: item.href,
        badgeKey: item.badgeKey,
        tab: !item.opensAiPanel && !item.featured && !item.isLogout,
        ...(section ? { section } : {}),
      });
    }
  }
  return out;
}

export interface SectionChip {
  name: string;
  /** Where the chip goes: the first tab of that section. */
  href: string;
  active: boolean;
}

export interface Section {
  /** The group the page is in; undefined for a page outside the menu (profile, a coming-soon page). */
  group?: string;
  /** The menu name of this page, when the menu has one. */
  title?: string;
  /** All tabs of the group. When `sections` is set, show only the tabs of the active section (`visibleTabs`). */
  tabs: Tab[];
  /** Which tab is the current page. */
  activeHref?: string;
  /** Chips for a long tab row, one per section, in menu order. Undefined when the row is short enough as it is. */
  sections?: SectionChip[];
  /** The tabs to show in the row: those of the active section, or all of them when there are no sections. */
  visibleTabs: Tab[];
}

/**
 * Splits a tab row longer than MAX_FLAT_TABS into sections. It applies only when every tab names a section and there are
 * at least two of them; otherwise the row stays flat. The active section is the one holding the current page (the first
 * section when the page is not a tab).
 */
export function groupTabs(tabs: readonly Tab[], activeHref: string | undefined): { sections?: SectionChip[]; visibleTabs: Tab[] } {
  if (tabs.length <= MAX_FLAT_TABS || tabs.some((t) => !t.section)) return { visibleTabs: [...tabs] };
  const names = [...new Set(tabs.map((t) => t.section as string))];
  if (names.length < 2) return { visibleTabs: [...tabs] };
  const current = tabs.find((t) => t.href === activeHref)?.section ?? names[0];
  const sections = names.map((name) => ({ name, href: (tabs.find((t) => t.section === name) as Tab).href, active: name === current }));
  return { sections, visibleTabs: tabs.filter((t) => t.section === current) };
}

export function resolveSection(groups: readonly SourceGroup[], canSee: (permission: string) => boolean, pathname: string, search: SearchLike): Section {
  const entries = entriesOf(groups, canSee);
  const href = bestMatchHref(pathname, search, entries.map((e) => e.href));
  const active = entries.find((e) => e.href === href);
  if (!active) return { tabs: [], visibleTabs: [] };
  const all: Tab[] =
    active.group === LAUNCHER_GROUP
      ? []
      : entries
          .filter((e) => e.group === active.group && e.tab)
          .map(({ label, href: h, badgeKey, section }) => ({ label, href: h, ...(badgeKey ? { badgeKey } : {}), ...(section ? { section } : {}) }));
  const tabs = all.length >= 2 ? all : [];
  const activeHref = active.tab ? active.href : undefined;
  return { group: active.group, title: active.label, tabs, activeHref, ...groupTabs(tabs, activeHref) };
}
