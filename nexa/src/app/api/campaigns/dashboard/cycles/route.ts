import { requirePermission } from "@/lib/auth/guard";
import { listDashboardCycles } from "@/features/campaign/dashboard-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:approve");
    return ok(await listDashboardCycles(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}
