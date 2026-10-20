/**
 * The pages a person has gone through inside the app this tab, so the
 * on-screen back arrow can return to where they actually came from (home,
 * the services page, a notification, a list) instead of a fixed parent page.
 *
 * Kept as a plain trail of addresses with one rule: arriving at a page that is
 * already in the trail cuts the trail back to it. That covers going back and
 * stops the arrow from bouncing between two pages (list → detail → list → …).
 * Pure functions so the rule can be checked on its own; the browser part only
 * reads and writes sessionStorage.
 */

const KEY = "gv-nav-trail";
/** Enough for any real path through the app; older entries drop off. */
export const MAX_TRAIL = 30;

/**
 * The trail after arriving at a page.
 *
 * @param trail Pages visited so far, oldest first.
 * @param href The page just opened (path and query).
 * @returns The new trail.
 */
export function arrive(trail: readonly string[], href: string): string[] {
  const at = trail.lastIndexOf(href);
  if (at !== -1) return trail.slice(0, at + 1);
  return [...trail, href].slice(-MAX_TRAIL);
}

/**
 * Where the back arrow should go.
 *
 * @param trail Pages visited so far, oldest first; the last one is the current page.
 * @returns The page before the current one, or null when the person opened this page first.
 */
export function previousOf(trail: readonly string[]): string | null {
  return trail.length >= 2 ? trail[trail.length - 2] : null;
}

/** Reads the trail; an empty list when storage is blocked or unreadable. */
export function readTrail(): string[] {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Records arriving at a page. */
export function recordArrival(href: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(arrive(readTrail(), href)));
  } catch {
    // Private mode or storage full: the arrow falls back to the page's fixed parent.
  }
}
