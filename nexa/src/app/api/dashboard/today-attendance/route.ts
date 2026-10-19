import { type NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { ok, handleApiError } from "@/lib/api/response";
import { loadTodayAttendance } from "@/features/attendance-status/service";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Today's attendance picture (who scanned in, late, absent, on leave) for the
 * dashboard to refresh on its own. Same rule as the dashboard section it feeds:
 * people who can approve or manage attendance, narrowed to their own team unless
 * company-wide. It is read fresh on every call and never cached.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAnyPermission(["attendance:approve", "attendance:manage"]);
    const departmentIds = req.nextUrl.searchParams.getAll("dept").filter((id) => UUID_RE.test(id));
    const response = ok(await loadTodayAttendance(session.companyId, session, departmentIds));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
