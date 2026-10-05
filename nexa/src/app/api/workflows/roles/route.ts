import { requirePermission } from "@/lib/auth/guard";
import { listApproverRoles } from "@/features/workflow/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/**
 * Role names a workflow step can be assigned to. The workflow form used to read
 * /api/admin/roles, which needs `admin:read` — HR Manager holds `workflow:*` but
 * not `admin:*`, so their approver dropdown was always empty. This returns only
 * id + name (no permission matrix), gated by the same `workflow:read` as the rest.
 */
export async function GET() {
  try {
    const session = await requirePermission("workflow:read");
    return ok(await listApproverRoles(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}
