import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth/guard";
import { NotFound } from "@/lib/api/errors";
import { handleApiError, ok } from "@/lib/api/response";
import { loadEmployeeAttendanceSummary } from "@/features/attendance-status/service";

export const runtime = "nodejs";

const querySchema = z.object({ code: z.string().trim().min(1).max(50) });

/**
 * Last 30 days of one person for the attendance side panel: counts of present,
 * late, absent and (non-sick) leave days plus the 10 latest days. Read-only.
 * Needs attendance:approve or attendance:manage and only returns people inside
 * the caller's team scope (a manager gets 404 for anyone else). It never
 * includes photos or locations.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAnyPermission(["attendance:approve", "attendance:manage"]);
    const { code } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const summary = await loadEmployeeAttendanceSummary(session.companyId, session, code);
    if (!summary) throw NotFound("ไม่พบพนักงาน");
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
