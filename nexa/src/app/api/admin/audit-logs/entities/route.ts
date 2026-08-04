import { requirePermission } from "@/lib/auth/guard";
import { listAuditEntities } from "@/features/audit/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("admin:read");
    const entities = await listAuditEntities(session.companyId);
    return ok(entities);
  } catch (err) {
    return handleApiError(err);
  }
}
