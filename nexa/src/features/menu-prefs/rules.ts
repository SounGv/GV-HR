/**
 * One person's own sidebar layout, kept on their account (users.menuPrefs).
 *
 * Groups are identified by their label and items by their href, the same keys
 * the sidebar already uses. A saved list only has to name what the person
 * moved: anything it does not mention keeps its default place, so a menu item
 * added later simply appears at the end of its group. Hiding an item never
 * removes anyone's permission to open the page; it only takes it off this
 * person's sidebar.
 */

export interface MenuPrefs {
  /** Group labels in the order this person wants them. */
  groupOrder: string[];
  /** Item hrefs in the order this person wants them, per group label. */
  itemOrder: Record<string, string[]>;
  /** Item hrefs taken off the sidebar. */
  hidden: string[];
  /** Item hrefs shown again at the top as favourites, in this order. */
  pinned: string[];
}

export const EMPTY_MENU_PREFS: MenuPrefs = { groupOrder: [], itemOrder: {}, hidden: [], pinned: [] };

/** Upper bound for every saved list, so one account cannot store an oversized document. */
export const MAX_MENU_PREF_ENTRIES = 200;

interface ItemLike {
  href: string;
  /** The sign-out row: always last in its group and never moved or hidden. */
  isLogout?: boolean;
}

interface GroupLike<I extends ItemLike> {
  label: string;
  items: I[];
}

/**
 * Puts `defaults` in the saved order. Unknown ids in `saved` are ignored and
 * anything `saved` does not mention keeps its default order after the rest.
 *
 * @param defaults Everything that exists, in its default order.
 * @param idOf Reads the id of one entry.
 * @param saved The person's saved order, or undefined when they never set one.
 * @returns A new array with the same entries.
 */
export function orderByIds<T>(defaults: T[], idOf: (entry: T) => string, saved: string[] | undefined): T[] {
  if (!saved || saved.length === 0) return [...defaults];
  const byId = new Map(defaults.map((entry) => [idOf(entry), entry]));
  const ordered: T[] = [];
  const used = new Set<string>();
  for (const id of saved) {
    const entry = byId.get(id);
    if (entry && !used.has(id)) {
      ordered.push(entry);
      used.add(id);
    }
  }
  for (const entry of defaults) if (!used.has(idOf(entry))) ordered.push(entry);
  return ordered;
}

/**
 * The groups and their items in this person's order. Hidden items are kept
 * (the editor shows them faded); the sidebar filters them with `isHidden`.
 *
 * @param groups The default menu.
 * @param prefs The person's saved layout.
 * @returns New group objects with reordered `items`; the sign-out row stays last.
 */
export function orderMenu<I extends ItemLike, G extends GroupLike<I>>(groups: G[], prefs: MenuPrefs): G[] {
  return orderByIds(groups, (g) => g.label, prefs.groupOrder).map((group) => {
    const movable = group.items.filter((i) => !i.isLogout);
    const fixedLast = group.items.filter((i) => i.isLogout);
    const ordered = orderByIds(movable, (i) => i.href, prefs.itemOrder[group.label]);
    return { ...group, items: [...ordered, ...fixedLast] };
  });
}

/** True when the person took this item off their sidebar. */
export function isHidden(prefs: MenuPrefs, href: string): boolean {
  return prefs.hidden.includes(href);
}

/**
 * The favourites, in the order they were pinned, skipping any item that no
 * longer exists, is the sign-out row, or is not in `visible`.
 *
 * @param groups The default menu.
 * @param prefs The person's saved layout.
 * @param visible Decides whether this person may see an item (permissions).
 */
export function pinnedItems<I extends ItemLike>(groups: GroupLike<I>[], prefs: MenuPrefs, visible: (item: I) => boolean): I[] {
  const all = new Map<string, I>();
  for (const group of groups) for (const item of group.items) if (!item.isLogout) all.set(item.href, item);
  const out: I[] = [];
  for (const href of prefs.pinned) {
    const item = all.get(href);
    if (item && visible(item)) out.push(item);
  }
  return out;
}

/** Moves one id a step up (-1) or down (+1) in a list; a move past either end changes nothing. */
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** True when the layout changes nothing, so saving it is the same as resetting to the default menu. */
export function isDefaultMenuPrefs(prefs: MenuPrefs): boolean {
  return (
    prefs.groupOrder.length === 0 &&
    prefs.hidden.length === 0 &&
    prefs.pinned.length === 0 &&
    Object.values(prefs.itemOrder).every((ids) => ids.length === 0)
  );
}

/** Adds the id when it is not in the list, removes it when it is. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function uniqueStrings(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && allowed.has(entry) && !out.includes(entry)) out.push(entry);
    if (out.length >= MAX_MENU_PREF_ENTRIES) break;
  }
  return out;
}

/**
 * Cleans a layout that came from outside (a request body or the database):
 * wrong shapes become empty, ids the menu does not have are dropped, duplicates
 * collapse, the sign-out row is removed, and lists are capped.
 *
 * @param input Whatever was received.
 * @param groups The default menu, which defines which ids are real.
 * @returns A layout that is safe to store and to apply.
 */
export function sanitizeMenuPrefs<I extends ItemLike>(input: unknown, groups: GroupLike<I>[]): MenuPrefs {
  if (!input || typeof input !== "object") return { ...EMPTY_MENU_PREFS, itemOrder: {} };
  const raw = input as Record<string, unknown>;

  const groupLabels = new Set(groups.map((g) => g.label));
  const allHrefs = new Set(groups.flatMap((g) => g.items.filter((i) => !i.isLogout).map((i) => i.href)));

  const itemOrder: Record<string, string[]> = {};
  const rawOrder = raw.itemOrder && typeof raw.itemOrder === "object" ? (raw.itemOrder as Record<string, unknown>) : {};
  for (const group of groups) {
    const hrefs = new Set(group.items.filter((i) => !i.isLogout).map((i) => i.href));
    const ids = uniqueStrings(rawOrder[group.label], hrefs);
    if (ids.length > 0) itemOrder[group.label] = ids;
  }

  return {
    groupOrder: uniqueStrings(raw.groupOrder, groupLabels),
    itemOrder,
    hidden: uniqueStrings(raw.hidden, allHrefs),
    pinned: uniqueStrings(raw.pinned, allHrefs),
  };
}
