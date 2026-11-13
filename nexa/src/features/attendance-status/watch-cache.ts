import { revalidateTag } from "next/cache";

/** Cache tag for one company's attendance watch lists (the dashboard's "ควรติดตาม" card). */
export function attendanceWatchTag(companyId: string): string {
  return `attendance-watch:${companyId}`;
}

/**
 * Drops the company's cached watch lists so the next dashboard view rebuilds
 * them. Call after anything that changes a past day's status: a leave approved,
 * rejected or cancelled, a time correction approved, an attendance import.
 * Without it, a sick leave approved after the fact still showed as "ขาด" until
 * the cache was rebuilt (13 Nov 2026).
 */
export function refreshAttendanceWatch(companyId: string): void {
  try {
    revalidateTag(attendanceWatchTag(companyId));
  } catch {
    // Outside a Next request (scripts, checks) there is no cache to drop.
  }
}
