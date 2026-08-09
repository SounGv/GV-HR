import { requirePermission } from "@/lib/auth/guard";
import { getDepartmentSummary } from "@/features/performance/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("performance:approve");
    const rows = await getDepartmentSummary(session.companyId, session);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
