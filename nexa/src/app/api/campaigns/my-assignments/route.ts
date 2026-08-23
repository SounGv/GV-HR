import { requirePermission } from "@/lib/auth/guard";
import { getMyEvaluationAssignments } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:read");
    const rows = await getMyEvaluationAssignments(session.companyId, session);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
