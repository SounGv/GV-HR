import { type NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { monthQuerySchema } from "@/features/calendar/schema";
import { getMonthAttendanceCounts } from "@/features/calendar/day-service";
import { bangkokParts } from "@/lib/datetime";

export const runtime = "nodejs";

/**
 * Absent / on leave / late head-counts per day for the numbers inside each calendar cell. Same permission and team scope as the
 * attendance overview on the dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAnyPermission(["attendance:approve", "attendance:manage"]);
    const { month } = monthQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const { year, month: m } = bangkokParts();
    const resolved = month ?? `${year}-${String(m).padStart(2, "0")}`;
    return ok({ month: resolved, days: await getMonthAttendanceCounts(session.companyId, session, resolved) });
  } catch (err) {
    return handleApiError(err);
  }
}
