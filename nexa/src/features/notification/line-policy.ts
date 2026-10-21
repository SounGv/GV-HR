/**
 * Which in-app notifications are also pushed to LINE.
 *
 * LINE counts every push to every person against a monthly free allowance, so
 * only messages a person has to act on or wants an answer to go there: leave,
 * OT, time corrections, approval workflows, expense and medical claims,
 * evaluations, meeting invitations (few, and tied to a time), and messages HR
 * sends by hand. Everything else (announcements, KPI, assets, AI replies,
 * system notices) stays in the app's inbox.
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
  "meeting",
  "hr",
]);

/**
 * Whether every check-in and check-out is posted to the LINE groups. Off by
 * default: with about 100 staff scanning twice a day that is thousands of
 * messages a month, far over what a LINE plan allows. Today's attendance is on
 * the dashboard. Set LINE_GROUP_POST_SCANS=true to bring the posts back.
 */
export function shouldPostScansToLineGroups(): boolean {
  return process.env.LINE_GROUP_POST_SCANS === "true";
}

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
