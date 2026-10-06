import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { NotFound } from "@/lib/api/errors";
import { handleApiError, ok } from "@/lib/api/response";
import { loadEmployeeLeaveYear } from "@/features/report/leave-detail";

export const runtime = "nodejs";

const querySchema = z.object({
  code: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * One person's leave for a year (per-type entitlement / used / remaining /
 * pending and every request) for the leave report's side panel. Needs
 * report:read and only returns people inside the caller's team scope (a manager
 * gets 404 for anyone else). Reasons and attachments are never included.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("report:read");
    const { code, year } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const detail = await loadEmployeeLeaveYear(session.companyId, session, code, year);
    if (!detail) throw NotFound("ไม่พบพนักงาน");
    return ok(detail);
  } catch (err) {
    return handleApiError(err);
  }
}
