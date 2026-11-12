import { after } from "next/server";

/**
 * Runs best-effort work (LINE messages) after the response has gone out, so the
 * person tapping "เช็คอิน" or "ส่งคำขอลา" does not wait on LINE. Vercel keeps
 * the function alive until the work finishes.
 *
 * Outside a request (scripts, cron helpers called directly) there is no
 * response to wait for, so the work simply runs now.
 *
 * @param work Something that never throws (the LINE helpers swallow their own errors).
 */
export async function runAfterResponse(work: () => Promise<unknown>): Promise<void> {
  try {
    after(work);
  } catch {
    await work();
  }
}
