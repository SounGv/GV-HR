/**
 * Which in-app notifications are also pushed to LINE, personally and to the
 * HR LINE group.
 *
 * LINE counts every push to every person against the monthly allowance, and
 * the company's LINE account is on the free plan (300 messages a month, none
 * beyond it). The owner chose on 2026-11-12 to send only leave, OT,
 * time-correction requests (and their answers) and evaluations (round
 * invitations and reminders follow the round's own LINE switch; results
 * follow this list) for now; everything else, missed-scan alerts included,
 * stays in the app's inbox.
 * The earlier, longer list was: leave, overtime, attendance, workflow,
 * expense, medical, performance, evaluation, meeting, hr.
 *
 * 2026-11-17: the free plan ran out of messages in the middle of the month, so
 * the answers ("approved", "not approved", "cancelled") of leave, OT and
 * time-correction requests stay in the app too. LINE keeps what a person has
 * to act on: requests waiting for approval, and evaluation round messages.
 */
export const LINE_CATEGORIES: ReadonlySet<string> = new Set([
  "leave",
  "overtime",
  "attendance-correction",
  "evaluation",
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
 * Whether a notice only reports an answer or a change to a request (approved, not approved, cancelled), not something to do.
 *
 * @param title The notification title as shown to the person.
 */
export function isAnswerNotice(title: string): boolean {
  return /ได้รับอนุมัติ|ไม่ได้รับอนุมัติ|ถูกยกเลิก|ยกเลิก/.test(title);
}

/**
 * Whether a notification should also go to LINE.
 *
 * @param category Notification category; missing means "system".
 * @param explicit The caller's own `line` choice, which always wins when given.
 * @param title The title; with it, answers to requests stay in the app (see the note above). Evaluation messages are never held back.
 */
export function shouldPushToLine(category: string | undefined, explicit?: boolean, title?: string): boolean {
  if (explicit !== undefined) return explicit;
  const c = category ?? "system";
  if (!LINE_CATEGORIES.has(c)) return false;
  if (title !== undefined && c !== "evaluation" && isAnswerNotice(title)) return false;
  return true;
}
