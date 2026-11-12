/**
 * Which in-app notifications are also pushed to LINE, personally and to the
 * HR LINE group.
 *
 * LINE counts every push to every person against the monthly allowance, and
 * the company's LINE account is on the free plan (300 messages a month, none
 * beyond it). The owner chose on 2026-11-12 to send only leave and OT requests
 * (and their answers) for now; everything else stays in the app's inbox.
 * The earlier, longer list was: leave, overtime, attendance, workflow,
 * expense, medical, performance, evaluation, meeting, hr.
 */
export const LINE_CATEGORIES: ReadonlySet<string> = new Set(["leave", "overtime"]);

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
