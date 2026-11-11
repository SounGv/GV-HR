import { requirePermission } from "@/lib/auth/guard";
import { listOrgPeople } from "@/features/organization/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** Active employees of the caller's company with department, manager and position, for the org chart. */
export async function GET() {
  try {
    const session = await requirePermission("employee:read");
    const records = await listOrgPeople(session.companyId);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}
