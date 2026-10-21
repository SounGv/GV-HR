/**
 * Which in-app notifications are also pushed to LINE.
 *
 * LINE counts every push to every person against a monthly free allowance, so
 * only messages a person has to act on or wants an answer to go there: leave,
 * OT, time corrections, approval workflows, expense and medical claims,
 * evaluations, and messages HR sends by hand. Everything else (announcements,
 * meetings, KPI, assets, AI replies, system notices) stays in the app's inbox.
 */
export const LINE_CATEGORIES: ReadonlySet<string> = new Set([
  "leave",
  "overtime",
  "attendance",
  "workflow",
  "expense",
  "medical",
  "performance",
  "evaluation",
  "hr",
]);

/**
 * Whether a notification should also go to LINE.
 *
 * @param category Notification category; missing means "system".
 * @param explicit The caller's own `line` choice, which always wins when given.
 */
export function shouldPushToLine(category: string | undefined, explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return LINE_CATEGORIES.has(category ?? "system");
}
